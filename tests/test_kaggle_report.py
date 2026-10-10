import sys
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path
from types import SimpleNamespace

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))
from update_kaggle import awards, build_report, collect_pages, competition_link, relevance


class KaggleReportTests(unittest.TestCase):
    def test_only_future_deadlines_and_official_links(self):
        now = datetime(2026, 9, 19, tzinfo=timezone.utc)
        def item(title, delta, ref):
            return SimpleNamespace(title=title, deadline=now + timedelta(days=delta), ref=ref, category="Research", reward="$10,000", awardsPoints=False)
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
        self.assertEqual(report["competitions"][0]["awardTypes"], ["cash"])

    def test_cash_medals_and_nonqualifying_rewards(self):
        self.assertEqual(awards(SimpleNamespace(reward="USD $35,000", awardsPoints=False, category="Community"))[0], ["cash"])
        self.assertEqual(awards(SimpleNamespace(reward="Kudos", awardsPoints=True, category="Featured"))[0], ["medal"])
        self.assertEqual(awards(SimpleNamespace(reward="Swag", awardsPoints=False, category="Playground"))[0], [])
        self.assertEqual(awards(SimpleNamespace(reward="Kudos", awardsPoints=True, awardsMedals=False, category="Featured"))[0], [])
        self.assertEqual(awards(SimpleNamespace(reward="Kudos", awardsPoints=True, category="Analytics"))[0], [])

    def test_research_cash_and_medals_and_paper_cash_without_medals(self):
        now = datetime(2026, 10, 10, tzinfo=timezone.utc)
        rows = [
            SimpleNamespace(ref="rsna-knee-abnormality-detection", title="RSNA Knee Abnormality Detection", deadline=now + timedelta(days=12), category="Research", reward="$77,000", awardsPoints=True),
            SimpleNamespace(ref="arc-prize-2026-paper-track", title="ARC Prize 2026 - Paper Track", deadline=now + timedelta(days=30), category="Featured", reward="$450,000", awardsPoints=False),
        ]
        report = build_report([rows], now)
        by_slug = {row["slug"]: row for row in report["competitions"]}
        self.assertEqual(by_slug["rsna-knee-abnormality-detection"]["awardTypes"], ["cash", "medal"])
        self.assertEqual(by_slug["arc-prize-2026-paper-track"]["awardTypes"], ["cash"])

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

    def test_empty_listing_is_an_error_but_no_qualifying_awards_is_valid(self):
        now = datetime(2026, 9, 19, tzinfo=timezone.utc)
        with self.assertRaises(RuntimeError):
            build_report([[]], now)
        report = build_report([[SimpleNamespace(title="No prize", deadline=now+timedelta(days=1), ref="practice", reward="Swag", category="Playground", awardsPoints=False)]], now)
        self.assertEqual(report["count"], 0)


if __name__ == "__main__":
    unittest.main()
