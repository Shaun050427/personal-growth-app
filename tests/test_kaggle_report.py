import sys
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path
from types import SimpleNamespace

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))
from update_kaggle import build_report, collect_pages, competition_link, relevance


class KaggleReportTests(unittest.TestCase):
    def test_only_future_deadlines_and_official_links(self):
        now = datetime(2026, 9, 19, tzinfo=timezone.utc)
        def item(title, delta, ref):
            return SimpleNamespace(title=title, deadline=now + timedelta(days=delta), ref=ref, category="Research")
        rows = [
            item("Photonics chip modeling", 5, "https://www.kaggle.com/competitions/photonics-chip"),
            item("Expired", -1, "https://www.kaggle.com/competitions/expired"),
            item("Invalid host", 5, "https://other.example/competitions/invalid"),
            item("No deadline", 0, "https://www.kaggle.com/competitions/today"),
        ]
        report = build_report([rows], now)
        self.assertEqual(report["count"], 1)
        self.assertEqual(report["competitions"][0]["slug"], "photonics-chip")
        self.assertEqual(report["competitions"][0]["url"], "https://www.kaggle.com/competitions/photonics-chip")

    def test_relevance_and_explainable_tags(self):
        high, tags = relevance("Optical photonic chip image restoration", "Deep learning")
        low, low_tags = relevance("Housing prices", "")
        self.assertGreater(high, low)
        self.assertEqual(set(tags), {"光芯片", "图像生成/复原", "光学", "AI算法"})
        self.assertEqual(low_tags, [])

    def test_url_cannot_leave_kaggle(self):
        self.assertIsNone(competition_link("https://evil.example/competitions/test"))
        self.assertIsNone(competition_link("../unexpected"))

    def test_official_pagination_uses_general_latest_deadline(self):
        class Api:
            calls = []
            def competitions_list(self, **kwargs):
                self.calls.append(kwargs)
                rows = [SimpleNamespace(ref=f"competition-{i}") for i in range(20)] if kwargs["page"] == 1 else [SimpleNamespace(ref="last")]
                return SimpleNamespace(competitions=rows)
        api = Api()
        pages = collect_pages(api)
        self.assertEqual(list(map(len, pages)), [20, 1])
        self.assertEqual(api.calls[0], {"group": "general", "sort_by": "latestDeadline", "page": 1})

    def test_empty_active_report_is_an_error(self):
        now = datetime(2026, 9, 19, tzinfo=timezone.utc)
        with self.assertRaises(RuntimeError):
            build_report([[SimpleNamespace(title="Expired", deadline=now-timedelta(days=1), ref="old")]], now)


if __name__ == "__main__":
    unittest.main()
