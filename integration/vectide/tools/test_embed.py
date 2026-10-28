"""Exercise input bounds and no-clobber publication without a model or Python ML runtime."""

import hashlib
import json
import tempfile
import unittest
from pathlib import Path

from embed import questions, write_vectors


class EmbeddingIoTests(unittest.TestCase):
    def test_only_question_text_is_selected_and_consumed_bytes_are_hashed(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "input.jsonl"
            first = json.dumps({"key": 7, "text": "質問", "answer": "除外", "title": "記事"}) + "\n"
            path.write_text(first + "invalid ignored suffix\n")
            rows, digest = questions(path, 1, 4096)
            self.assertEqual(rows, [{"id": 7, "text": "質問"}])
            self.assertEqual(digest, hashlib.sha256(first.encode()).hexdigest())
            path.write_text(json.dumps({"key": True, "text": "質問"}) + "\n")
            with self.assertRaises(ValueError):
                questions(path, 1, 4096)
            path.write_bytes(b" " * (256 * 1024 + 1))
            with self.assertRaises(ValueError):
                questions(path, 1, 4096)

    def test_existing_output_and_staging_are_never_removed(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "out.jsonl"
            stage = path.with_suffix(".jsonl.partial")
            stage.write_text("keep stage")
            with self.assertRaises(FileExistsError):
                write_vectors(path, ["new"])
            self.assertEqual(stage.read_text(), "keep stage")
            stage.unlink()
            path.write_text("keep target")
            with self.assertRaises(FileExistsError):
                write_vectors(path, ["new"])
            self.assertEqual(path.read_text(), "keep target")
            self.assertFalse(stage.exists())

    def test_failed_generation_leaves_no_partial_and_success_is_exact(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "out.jsonl"

            def failure():
                yield "partial"
                raise ValueError("model failure")

            with self.assertRaises(ValueError):
                write_vectors(path, failure())
            self.assertEqual(list(Path(directory).iterdir()), [])
            digest = write_vectors(path, ["a\n", "b\n"])
            self.assertEqual(path.read_bytes(), b"a\nb\n")
            self.assertEqual(digest, hashlib.sha256(b"a\nb\n").hexdigest())


if __name__ == "__main__":
    unittest.main()
