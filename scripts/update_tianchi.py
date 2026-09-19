#!/usr/bin/env python3
"""Refresh active Tianchi competitions from the official listing's JSON feed."""
from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import Request, urlopen
from zoneinfo import ZoneInfo

from update_kaggle import relevance

OUTPUT = Path(__file__).resolve().parent.parent / "data" / "tianchi-active.json"
API = "https://tianchi.aliyun.com/v3/proxy/competition/api/race/page"
BEIJING = ZoneInfo("Asia/Shanghai")
MAX_PAGES = 100
CATEGORIES = {1: "AI大模型赛", 2: "数据算法赛", 3: "工程开发赛", 4: "日常学习赛"}


def official_time(raw):
    if not raw:
        return None
    try:
        value = datetime.fromisoformat(str(raw).replace("Z", "+00:00"))
    except ValueError:
        return None
    return value.replace(tzinfo=BEIJING) if value.tzinfo is None else value.astimezone(BEIJING)


def normalize(row, now, parent_name=""):
    """Only publish races with verified active dates and numeric official IDs."""
    race_id = str(row.get("raceId") or "")
    if not race_id.isascii() or not race_id.isdigit():
        return None
    start, end = official_time(row.get("raceStartTime")), official_time(row.get("raceEndTime"))
    if not start or not end or start > now or end <= now or row.get("raceListStatus") in (2, 3):
        return None
    name = str(row.get("name") or "").strip()
    if not name:
        return None
    title = (parent_name + " - " + name if parent_name else name)[:300]
    description = str(row.get("introduction") or "").strip()[:1500]
    category = CATEGORIES.get(row.get("visualTab"), "天池竞赛")
    labels = row.get("tagsList") or []
    label_text = " ".join(str(t.get("tagNameCn") or t.get("tagName") or "")[:80] for t in labels[:10] if isinstance(t, dict))
    score, tags = relevance(title, f"{description} {category} {label_text}")
    signup_end = official_time(row.get("signupEndTime"))
    return {
        "slug": race_id, "title": title,
        "url": f"https://tianchi.aliyun.com/competition/entrance/{race_id}",
        "deadline": end.astimezone(timezone.utc).isoformat().replace("+00:00", "Z"),
        "endDate": end.astimezone(BEIJING).date().isoformat(),
        "signupDeadline": signup_end.astimezone(timezone.utc).isoformat().replace("+00:00", "Z") if signup_end else None,
        "category": category, "score": score, "tags": tags,
    }


def build_report(pages, now, *, expected_total=None):
    found = {}
    checked = 0
    for page in pages:
        for row in page:
            checked += 1
            parent = normalize(row, now)
            if parent:
                found[parent["slug"]] = parent
            for track in row.get("trackList") or []:
                checked += 1
                child = normalize(track, now, str(row.get("name") or ""))
                if child:
                    found[child["slug"]] = child
    if not checked or expected_total is not None and sum(len(page) for page in pages) != expected_total:
        raise RuntimeError("Tianchi listing was empty or incomplete; preserving the last good report")
    items = sorted(found.values(), key=lambda x: (-x["score"], x["deadline"], x["slug"]))
    return {
        "source": "Tianchi official public competition listing", "generatedAt": now.isoformat().replace("+00:00", "Z"),
        "timeZone": "Asia/Shanghai", "deadlineKind": "race_end_timestamp", "checked": checked,
        "count": len(items), "competitions": items,
    }


def fetch_pages():
    pages = []
    expected_total = None
    for number in range(1, MAX_PAGES + 1):
        query = urlencode({"visualTab": "", "raceName": "", "pageNum": number, "isActive": 1})
        request = Request(API + "?" + query, headers={
            "Accept": "application/json", "Referer": "https://tianchi.aliyun.com/competition/", "User-Agent": "Mozilla/5.0"
        })
        with urlopen(request, timeout=35) as response:
            payload = json.load(response)
        data = payload.get("data") or {}
        rows = data.get("list")
        if payload.get("success") is not True or not isinstance(rows, list) or data.get("pageNum") != number:
            raise RuntimeError(f"Tianchi listing rejected page {number}; keeping the last good report")
        total = data.get("total")
        size = data.get("pageSize")
        if not isinstance(total, int) or total <= 0 or expected_total is not None and total != expected_total or not isinstance(size, int) or size <= 0:
            raise RuntimeError("Tianchi listing total changed during refresh; keeping the last good report")
        if len(rows) != min(size, max(total - (number - 1) * size, 0)):
            raise RuntimeError(f"Tianchi page {number} has missing entries; preserving the last good report")
        expected_total = total
        pages.append(rows)
        print(f"Tianchi page {number}: {len(rows)} entries / {total} total", flush=True)
        # The upstream response currently returns hasNextPage=false and pages=0
        # even when total exceeds pageSize. Use the actual counts instead.
        if number * size >= total:
            return pages, expected_total
    raise RuntimeError("Tianchi listing exceeded MAX_PAGES; preserving the last good report")


def main():
    pages, total = fetch_pages()
    report = build_report(pages, datetime.now(timezone.utc), expected_total=total)
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    tmp = OUTPUT.with_suffix(".json.tmp")
    tmp.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    tmp.replace(OUTPUT)
    print(f"Checked {report['checked']} Tianchi races/tracks; {report['count']} still running")


if __name__ == "__main__":
    main()
