# /// script
# requires-python = ">=3.13,<3.14"
# dependencies = ["sentence-transformers==6.2.0", "torch==2.14.1"]
# ///
"""Produce independently tokenized native F32 vectors from the pinned upstream model."""

import hashlib
import json
import os
import sys
import time
from pathlib import Path

import sentence_transformers
import torch
from quality_cases import select_quality
from sentence_transformers import SentenceTransformer


def main() -> None:
    root = Path(__file__).resolve().parents[1]
    lock_bytes = (root / "model.lock.json").read_bytes()
    lock = json.loads(lock_bytes)
    input_path = Path(sys.argv[1])
    if input_path.stat().st_size > 32 * 1024 * 1024:
        raise ValueError("reference input bytes")
    inputs = json.loads(input_path.read_text())

    torch.set_num_threads(1)
    torch.use_deterministic_algorithms(True)
    start = time.perf_counter()
    model = SentenceTransformer(
        lock["upstream"],
        revision=lock["upstreamRevision"],
        cache_folder=str(root / ".reference" / "model"),
        device="cpu",
        trust_remote_code=False,
        model_kwargs={"attn_implementation": "eager", "dtype": torch.float32},
    )
    model.max_seq_length = lock["limits"]["tokens"]
    quality = None
    if isinstance(inputs, dict):
        inputs, quality = select_quality(model, lock, inputs)
    if not isinstance(inputs, list) or len(inputs) > 5000:
        raise ValueError("reference input limit")
    records = []
    for item in inputs:
        text, role = item["text"], item["role"]
        if role not in ("query", "document") or len(text.encode()) > lock["limits"]["textBytes"]:
            raise ValueError("reference text limit")
        prefixed = lock["queryPrefix" if role == "query" else "documentPrefix"] + text
        tokens = model.tokenizer(prefixed, truncation=False)["input_ids"]
        if len(tokens) > model.max_seq_length:
            raise ValueError("reference token limit")
        vector = model.encode([prefixed], normalize_embeddings=True, show_progress_bar=False)[0]
        records.append(
            {
                "id": item.get("id"),
                "text": text,
                "role": role,
                "tokens": tokens,
                "vector": vector.tolist(),
            }
        )

    output = {
        "schema": 1,
        "modelLockSha256": hashlib.sha256(lock_bytes).hexdigest(),
        "upstreamRevision": lock["upstreamRevision"],
        "torch": torch.__version__,
        "sentenceTransformers": sentence_transformers.__version__,
        "backend": "cpu-f32-eager",
        "threads": 1,
        "elapsedSeconds": time.perf_counter() - start,
        "records": records,
        "quality": quality,
        "inputSha256": hashlib.sha256(input_path.read_bytes()).hexdigest(),
        "referenceScriptSha256": hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
        "pythonLockSha256": hashlib.sha256(
            Path(str(Path(__file__)) + ".lock").read_bytes()
        ).hexdigest(),
    }
    destination = Path(sys.argv[2])
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_text(json.dumps(output, ensure_ascii=False) + "\n")
    print(f"Native F32 reference: {len(records)} vectors, {output['elapsedSeconds']:.2f}s")


if __name__ == "__main__":
    os.environ.setdefault("HF_HUB_DISABLE_TELEMETRY", "1")
    main()
