#!/usr/bin/env python3
"""Refresh the public Kaggle competition snapshot used by the static site."""
from __future__ import annotations

import json
import re
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlsplit

OUTPUT = Path(__file__).resolve().parent.parent / "data" / "kaggle-active.json"
MAX_PAGES = 10
PAGE_SIZE = 100

RULES = (
    ("光芯片", 40, re.compile(r"photonic[s]?\s*(integrated|chip|circuit|processor|accelerator)|silicon\s+photonics|optical\s+(computing|chip|neural\s+network|processor|accelerator)|光芯片|光计算|光子芯片|硅光", re.I)),
    ("图像生成/复原", 32, re.compile(r"image\s+(generation|synthesis|restoration|reconstruction|enhancement|inpainting|denoising|deblurring|dehazing|super[ -]?resolution)|text[ -]?to[ -]?image|diffusion\s+(model|image)|generative\s+imaging|图像生成|图像复原|图像重建|超分辨率|图像去噪", re.I)),
    ("光学", 24, re.compile(r"optical|optics|photonics?|holograph|microscop|spectroscop|interferometr|light[ -]?field|wavefront|lens(?:es)?|光学|光子|全息|显微|光谱|干涉", re.I)),
    ("AI算法", 20, re.compile(r"\bAI\b|machine\s+learning|deep\s+learning|artificial\s+intelligence|neural\s+network|transformer|large\s+language\s+model|\bLLM\b|computer\s+vision|generative\s+model|机器学习|深度学习|人工智能|神经网络|计算机视觉|生成模型", re.I)),
)


def as_utc(value):
    if value is None or value == "":
        return None
    if isinstance(value, datetime):
        date = value
    else:
        try:
            date = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
        except ValueError:
            return None
    return date.replace(tzinfo=timezone.utc) if date.tzinfo is None else date.astimezone(timezone.utc)


def competition_link(ref):
    ref = str(ref or "").strip()
    if ref.startswith(("https://", "http://")):
        url = urlsplit(ref)
        if url.hostname not in ("www.kaggle.com", "kaggle.com"):
            return None
        pieces = [p for p in url.path.split("/") if p]
        if len(pieces) != 2 or pieces[0] != "competitions":
            return None
        slug = pieces[1]
    else:
        slug = ref
    if not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9_-]*", slug):
        return None
    return "https://www.kaggle.com/competitions/" + slug


def relevance(title, subtitle=""):
    text = f"{title} {subtitle}"[:2000]
    tags = [name for name, _, pattern in RULES if pattern.search(text)]
    points = 10 + sum(weight for name, weight, _ in RULES if name in tags)
    if "光芯片" in tags and "光学" in tags:
        points += 6
    if "图像生成/复原" in tags and "AI算法" in tags:
        points += 6
    return min(points, 100), tags


def normalize(competition, now):
    deadline = as_utc(getattr(competition, "deadline", None))
    if not deadline or deadline <= now:
        return None
    url = competition_link(getattr(competition, "ref", ""))
    if not url:
        return None
    slug = url.rsplit("/", 1)[-1]
    title = str(getattr(competition, "title", "") or getattr(competition, "name", "") or slug.replace("-", " ").title()).strip()
    subtitle = str(getattr(competition, "subtitle", "") or "").strip()
    score, tags = relevance(title, subtitle)
    return {
        "slug": slug, "title": title[:300], "url": url, "deadline": deadline.isoformat().replace("+00:00", "Z"),
        "category": str(getattr(competition, "category", "") or "")[:100],
        "score": score, "tags": tags,
    }


def build_report(pages, now):
    by_slug = {}
    fetched = 0
    for page in pages:
        for competition in page:
            fetched += 1
            item = normalize(competition, now)
            if item:
                by_slug[item["slug"]] = item
    if not fetched:
        raise RuntimeError("Kaggle returned no competitions; keeping the previous report")
    items = sorted(by_slug.values(), key=lambda x: (-x["score"], x["deadline"], x["slug"]))
    return {
        "source": "Kaggle official competitions API", "generatedAt": now.isoformat().replace("+00:00", "Z"),
        "timeZone": "UTC", "checked": fetched, "count": len(items), "competitions": items,
    }


def main():
    # Import only in the scheduled job; unit tests can run without credentials.
    from kaggle.api.kaggle_api_extended import KaggleApi

    api = KaggleApi()
    api.authenticate()
    pages = []
    for number in range(1, MAX_PAGES + 1):
        response = api.competitions_list(group="general", sort_by="earliestDeadline", page=number, page_size=PAGE_SIZE)
        rows = list(getattr(response, "competitions", None) or [])
        pages.append(rows)
        if len(rows) < PAGE_SIZE:
            break
    report = build_report(pages, datetime.now(timezone.utc))
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    tmp = OUTPUT.with_suffix(".json.tmp")
    tmp.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    tmp.replace(OUTPUT)
    print(f"Fetched {report['checked']} Kaggle competitions; {report['count']} with a future deadline")


if __name__ == "__main__":
    main()
