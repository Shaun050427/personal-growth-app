#!/usr/bin/env python3
"""Collect active Tianchi competitions from the public official listing."""
from __future__ import annotations

import json
import re
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from urllib.parse import urlsplit
from zoneinfo import ZoneInfo

from update_kaggle import relevance

LIST_URL = "https://tianchi.aliyun.com/competition/"
OUTPUT = Path(__file__).resolve().parent.parent / "data" / "tianchi-active.json"
BEIJING = ZoneInfo("Asia/Shanghai")
MAX_PAGES = 100
DATE_RANGE = re.compile(r"比赛时间\s*[：:]\s*(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})\s*[~～—–-]\s*(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})")
OFFICIAL_LINK = re.compile(r"/competition/entrance/(\d+)(?:/)?$")


def normalize(row: dict, today: date):
    """Require an official link and a verified competition date range."""
    url = str(row.get("url") or "")
    parts = urlsplit(url)
    match = OFFICIAL_LINK.fullmatch(parts.path)
    if parts.scheme != "https" or parts.hostname != "tianchi.aliyun.com" or not match or parts.query or parts.fragment:
        return None
    times = DATE_RANGE.search(str(row.get("dateText") or ""))
    if not times:
        return None
    a = tuple(int(n) for n in times.groups())
    try:
        start, end = date(*a[:3]), date(*a[3:])
    except ValueError:
        return None
    status = str(row.get("status") or "")
    if start > today or end < today or "已结束" in status:
        return None
    title = str(row.get("title") or "").strip()[:300]
    if not title:
        return None
    description = str(row.get("description") or "").strip()[:1000]
    category = str(row.get("category") or "").strip()[:100]
    labels = row.get("labels") or []
    label_text = " ".join(str(x)[:80] for x in labels[:10]) if isinstance(labels, list) else ""
    # The official listing gives dates, not a submission cutoff timestamp.
    # Treat the end date as inclusive in Beijing time and name it clearly in the UI.
    deadline = datetime.combine(end + timedelta(days=1), datetime.min.time(), BEIJING).astimezone(timezone.utc)
    score, tags = relevance(title, f"{description} {category} {label_text}")
    return {
        "slug": match.group(1), "title": title,
        "url": f"https://tianchi.aliyun.com/competition/entrance/{match.group(1)}",
        "deadline": deadline.isoformat().replace("+00:00", "Z"),
        "endDate": end.isoformat(), "category": category or "天池竞赛",
        "score": score, "tags": tags,
    }


def build_report(pages, now):
    today = now.astimezone(BEIJING).date()
    found = {}
    checked = 0
    for page in pages:
        for row in page:
            checked += 1
            item = normalize(row, today)
            if item:
                found[item["slug"]] = item
    if not checked:
        raise RuntimeError("Tianchi returned no competition cards; preserving the last good report")
    items = sorted(found.values(), key=lambda x: (-x["score"], x["deadline"], x["slug"]))
    return {
        "source": "Tianchi public official competition listing", "generatedAt": now.isoformat().replace("+00:00", "Z"),
        "timeZone": "Asia/Shanghai", "deadlineKind": "competition_end_date",
        "checked": checked, "count": len(items), "competitions": items,
    }


def fetch_pages():
    # The listing is client-rendered; use its visible official cards instead of
    # undocumented internal JSON endpoints or user login/session cookies.
    from playwright.sync_api import sync_playwright

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True, args=["--no-sandbox"])
        try:
            page = browser.new_page(locale="zh-CN", timezone_id="Asia/Shanghai")
            page.goto(LIST_URL, wait_until="domcontentloaded", timeout=60000)
            card = page.locator('a[href^="/competition/entrance/"]:has(h1)').filter(has_text="比赛时间")
            card.first.wait_for(timeout=60000)
            pages = []
            last_ids = None
            for number in range(1, MAX_PAGES + 1):
                # CSS module class names vary; prefer semantic HTML and date text.
                rows = card.evaluate_all("""elements => elements.map(a => {
                    const heading = a.querySelector('h1');
                    const paras = [...a.querySelectorAll('p')];
                    const href = a.getAttribute('href');
                    const text = a.innerText || '';
                    const dateText = (text.match(/比赛时间\\s*[：:][^\\n]+/) || [''])[0];
                    const tags = [...a.querySelectorAll('span')].map(s => s.innerText).filter(t => t.startsWith('#'));
                    return {
                        url: new URL(href, location.origin).href,
                        title: heading?.innerText.replace(/^(AI大模型赛|数据算法赛|工程开发赛|日常学习赛)\\s*/, '').trim() || '',
                        description: paras[0]?.innerText || '',
                        category: heading?.innerText.match(/^(AI大模型赛|数据算法赛|工程开发赛|日常学习赛)/)?.[0] || '',
                        dateText, labels: [...new Set(tags)],
                        status: text.includes('已结束') ? '已结束' : ''
                    };
                })""")
                ids = tuple(row["url"] for row in rows)
                if not rows or ids == last_ids:
                    raise RuntimeError(f"Tianchi page {number} did not return fresh competition cards")
                pages.append(rows)
                print(f"Tianchi page {number}: {len(rows)} cards", flush=True)
                last_ids = ids
                next_button = page.locator("li.ant-pagination-next button")
                if not next_button.count() or not next_button.is_enabled():
                    break
                if number == MAX_PAGES:
                    raise RuntimeError("Tianchi listing exceeded MAX_PAGES; preserving the previous report")
                next_button.click()
                page.wait_for_function("""previous => {
                    const current = [...document.querySelectorAll('a[href^="/competition/entrance/"]')]
                      .find(a => a.querySelector('h1') && (a.innerText || '').includes('比赛时间'));
                    return current && new URL(current.getAttribute('href'), location.origin).href !== previous;
                }""", arg=ids[0], timeout=30000)
            return pages
        finally:
            browser.close()


def main():
    report = build_report(fetch_pages(), datetime.now(timezone.utc))
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    tmp = OUTPUT.with_suffix(".json.tmp")
    tmp.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    tmp.replace(OUTPUT)
    print(f"Checked {report['checked']} Tianchi cards; {report['count']} within official competition dates")


if __name__ == "__main__":
    main()
