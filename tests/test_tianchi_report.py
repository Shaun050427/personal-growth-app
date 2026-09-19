import sys
import unittest
from datetime import date, datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))
from update_tianchi import build_report, normalize


def sample(**changes):
    row = {
        "title": "CSIG 生成式图像增强算法挑战",
        "url": "https://tianchi.aliyun.com/competition/entrance/532499",
        "dateText": "比赛时间：2026.07.03 ~ 2026.09.20",
        "description": "计算机视觉与图像复原",
        "category": "AI大模型赛",
        "labels": ["# 计算机视觉"],
        "status": "立即报名",
    }
    row.update(changes)
    return row


class TianchiReportTests(unittest.TestCase):
    def test_official_link_and_inclusive_beijing_end_date(self):
        row = normalize(sample(), date(2026, 9, 20))
        self.assertEqual(row["deadline"], "2026-09-20T16:00:00Z")
        self.assertGreater(row["score"], 10)
        self.assertIn("图像生成/复原", row["tags"])
        self.assertGreaterEqual(row["score"], 60)
        self.assertIsNone(normalize(sample(), date(2026, 9, 21)))
        self.assertIsNone(normalize(sample(status="已结束"), date(2026, 9, 19)))

    def test_unknown_or_unsafe_dates_and_links_are_excluded(self):
        for changes in (
            {"dateText": "截止时间待定"},
            {"dateText": "比赛时间：2026.13.01 ~ 2026.14.01"},
            {"url": "https://evil.example/competition/entrance/532499"},
            {"url": "https://tianchi.aliyun.com.evil.example/competition/entrance/532499"},
            {"url": "https://tianchi.aliyun.com/competition/entrance/532499?redirect=evil.example"},
        ):
            with self.subTest(changes=changes):
                self.assertIsNone(normalize(sample(**changes), date(2026, 9, 19)))

    def test_report_deduplicates_and_keeps_last_good_on_empty(self):
        now = datetime(2026, 9, 19, tzinfo=timezone.utc)
        result = build_report([[sample(), sample()], [sample(url="https://tianchi.aliyun.com/competition/entrance/532500", dateText="比赛时间：2026.01.01 ~ 2026.05.01")]], now)
        self.assertEqual(result["checked"], 3)
        self.assertEqual(result["count"], 1)
        partial = build_report([[sample()]], now, complete=False, total_pages=60)
        self.assertEqual(partial["status"], "partial")
        self.assertEqual(partial["pagesChecked"], 1)
        with self.assertRaises(RuntimeError):
            build_report([[]], now)


if __name__ == "__main__":
    unittest.main()
