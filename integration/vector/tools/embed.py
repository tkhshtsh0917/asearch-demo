# /// script
# requires-python = ">=3.13,<3.14"
# dependencies = ["sentence-transformers==6.2.0", "torch==2.14.1"]
# ///
"""Encode original question text on the server with the pinned native F32 document profile."""

import argparse
import hashlib
import json
import math
import os
import time
from collections.abc import Iterable
from pathlib import Path


def arguments() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--limit", type=int, default=10_000)
    parser.add_argument("--batch-size", type=int, default=16)
    return parser.parse_args()


def questions(path: Path, limit: int, text_bytes: int) -> tuple[list[dict], str]:
    if path.stat().st_size > 64 * 1024 * 1024 or not 1 <= limit <= 50_000:
        raise ValueError("question input limit")
    rows, ids, digest = [], set(), hashlib.sha256()
    with path.open("rb") as source:
        while line := source.readline(256 * 1024 + 1):
            if len(line) > 256 * 1024:
                raise ValueError("question line limit")
            digest.update(line)
            row = json.loads(line)
            key, text = row["key"], row["text"]
            if type(key) is not int or not 0 <= key <= 0xFFFFFFFF or key in ids:
                raise ValueError("question IDs")
            if not isinstance(text, str) or not text.strip() or len(text.encode()) > text_bytes:
                raise ValueError("question text limit")
            rows.append({"id": key, "text": text})
            ids.add(key)
            if len(rows) == limit:
                break
    if len(rows) != limit:
        raise ValueError("question row count")
    return rows, digest.hexdigest()


def write_vectors(path: Path, lines: Iterable[str]) -> str:
    """Publish a fresh completed file without deleting pre-existing staging or output files."""
    temporary = path.with_suffix(path.suffix + ".partial")
    digest = hashlib.sha256()
    target = temporary.open("x", encoding="utf8", newline="\n")
    try:
        with target:
            for line in lines:
                target.write(line)
                digest.update(line.encode())
            target.flush()
            os.fsync(target.fileno())
        os.link(temporary, path)
    finally:
        temporary.unlink(missing_ok=True)
    return digest.hexdigest()


def main() -> None:
    args = arguments()
    metadata_path = args.output.with_suffix(".metadata.json")
    if not 1 <= args.batch_size <= 32 or args.output.exists() or metadata_path.exists():
        raise ValueError("batch size or existing output")
    root = Path(__file__).resolve().parents[1]
    profile = root.parent / "experiments" / "ruri"
    lock_bytes = (profile / "model.lock.json").read_bytes()
    lock = json.loads(lock_bytes)
    rows, input_digest = questions(args.input, args.limit, lock["limits"]["textBytes"])
    script_bytes = Path(__file__).read_bytes()
    python_lock = Path(str(Path(__file__)) + ".lock").read_bytes()

    import torch
    from sentence_transformers import SentenceTransformer

    torch.set_num_threads(1)
    torch.use_deterministic_algorithms(True)
    model = SentenceTransformer(
        lock["upstream"],
        revision=lock["upstreamRevision"],
        cache_folder=str(profile / ".reference" / "model"),
        device="cpu",
        trust_remote_code=False,
        model_kwargs={"attn_implementation": "eager", "dtype": torch.float32},
    )
    model.max_seq_length = lock["limits"]["tokens"]
    texts = [lock["documentPrefix"] + row["text"] for row in rows]
    counts = [len(model.tokenizer(text, truncation=False)["input_ids"]) for text in texts]
    rejected = [
        row["id"] for row, count in zip(rows, counts, strict=True) if count > model.max_seq_length
    ]
    if rejected:
        raise ValueError(f"document token limit: {len(rejected)} IDs; first IDs={rejected[:10]}")

    def lines() -> Iterable[str]:
        for offset in range(0, len(rows), args.batch_size):
            vectors = model.encode(
                texts[offset : offset + args.batch_size],
                normalize_embeddings=True,
                show_progress_bar=False,
                batch_size=args.batch_size,
            )
            for row, vector in zip(rows[offset : offset + args.batch_size], vectors, strict=True):
                values = vector.tolist()
                if len(values) != lock["dimensions"] or not all(map(math.isfinite, values)):
                    raise ValueError("native vector output")
                yield json.dumps({"id": row["id"], "vector": values}, separators=(",", ":")) + "\n"
        if Path(__file__).read_bytes() != script_bytes:
            raise ValueError("encoder script changed during execution")

    args.output.parent.mkdir(parents=True, exist_ok=True)
    began = time.perf_counter()
    digest = write_vectors(args.output, lines())
    metadata = {
        "schema": 1,
        "rows": len(rows),
        "dimensions": lock["dimensions"],
        "questionInputSha256": input_digest,
        "modelLockSha256": hashlib.sha256(lock_bytes).hexdigest(),
        "scriptSha256": hashlib.sha256(script_bytes).hexdigest(),
        "pythonLockSha256": hashlib.sha256(python_lock).hexdigest(),
        "embeddingJsonlSha256": digest,
        "maxTokens": max(counts),
        "backend": "cpu-f32-eager",
        "batchSize": args.batch_size,
        "threads": 1,
        "elapsedSeconds": time.perf_counter() - began,
        "scope": (
            "Original question text only; consumed JSONL prefix is hashed; "
            "no title, answer, snippet or lexical normalization."
        ),
    }
    write_vectors(metadata_path, [json.dumps(metadata, indent=2) + "\n"])
    print(json.dumps(metadata))


if __name__ == "__main__":
    os.environ.setdefault("HF_HUB_DISABLE_TELEMETRY", "1")
    main()
