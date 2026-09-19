import sys
import unittest
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))
from update_tianchi import build_report, normalize


def sample(**changes):
    row = {
        "name": "CSIG 生成式图像增强挑战", "raceId": 532499,
        "raceStartTime": "2026-07-03 00:00:00", "raceEndTime": "2026-09-20 23:59:59",
        "signupEndTime": "2026-09-19 23:59:59", "raceListStatus": 0,
        "introduction": "计算机视觉与图像复原", "visualTab": 1,
        "tagsList": [{"tagNameCn": "计算机视觉"}],
    }
    row.update(changes)
    return row


class TianchiReportTests(unittest.TestCase):
    def test_official_link_exact_deadline_and_research_score(self):
        now = datetime(2026, 9, 19, 12, 0, tzinfo=timezone.utc)
        row = normalize(sample(), now)
        self.assertEqual(row["deadline"], "2026-09-20T15:59:59Z")
        self.assertEqual(row["signupDeadline"], "2026-09-19T15:59:59Z")
        self.assertEqual(row["url"], "https://tianchi.aliyun.com/competition/entrance/532499")
        self.assertIn("图像生成/复原", row["tags"])
        self.assertGreaterEqual(row["score"], 60)
        self.assertIsNone(normalize(sample(), datetime(2026, 9, 21, tzinfo=timezone.utc)))

    def test_missing_dates_invalid_ids_and_ended_competitions(self):
        now = datetime(2026, 9, 19, tzinfo=timezone.utc)
        for changes in (
            {"raceEndTime": None}, {"raceEndTime": "2026-13-40"},
            {"raceId": "532499/../../evil"}, {"raceId": "https://evil.example"},
            {"raceListStatus": 2}, {"isSeries": 1},
        ):
            with self.subTest(changes=changes):
                self.assertIsNone(normalize(sample(**changes), now))

    def test_all_pages_tracks_deduplication_and_incomplete_guard(self):
        now = datetime(2026, 9, 19, tzinfo=timezone.utc)
        parent = sample(trackList=[sample(raceId=532500, name="赛道二")])
        result = build_report([[parent], [sample()]], now, expected_total=2)
        self.assertEqual(result["count"], 2)
        self.assertTrue(any("赛道二" in x["title"] for x in result["competitions"]))
        with self.assertRaises(RuntimeError):
            build_report([[parent]], now, expected_total=2)


if __name__ == "__main__":
    unittest.main()
