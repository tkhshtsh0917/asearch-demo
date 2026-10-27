"""Select deterministic token-eligible retrieval queries, positives and distractors."""

import hashlib


def select_quality(model, lock: dict, source: dict) -> tuple[list[dict], dict]:
    docs = {item["docid"]: item["text"] for item in source["documents"]}
    selected = []
    chosen = set()
    dropped = 0
    cache = {}

    def eligible(text: str, role: str) -> bool:
        key = (text, role)
        if key not in cache:
            prefix = lock["queryPrefix" if role == "query" else "documentPrefix"]
            cache[key] = (
                len(text.encode()) <= lock["limits"]["textBytes"]
                and len(model.tokenizer(prefix + text, truncation=False)["input_ids"])
                <= lock["limits"]["tokens"]
            )
        return cache[key]

    limits = source["pin"]["selection"]
    for item in source["queries"]:
        positives = item["relevant_docs"]
        if (
            not eligible(item["query"], "query")
            or not positives
            or any(key not in docs or not eligible(docs[key], "document") for key in positives)
        ):
            dropped += 1
            continue
        selected.append(item)
        chosen.update(positives)
        if len(selected) == limits["queries"]:
            break
    if len(selected) != limits["queries"]:
        raise ValueError("insufficient eligible labeled queries")
    order = sorted(docs, key=lambda key: hashlib.sha256((limits["seed"] + key).encode()).digest())
    for key in order:
        if len(chosen) >= limits["documents"]:
            break
        if eligible(docs[key], "document"):
            chosen.add(key)
    chosen = sorted(chosen)
    if len(chosen) != limits["documents"]:
        raise ValueError("quality document count")
    entries = [{"id": key, "text": docs[key], "role": "document"} for key in chosen]
    qrels = []
    for index, item in enumerate(selected):
        entries.append({"id": f"q{index}", "text": item["query"], "role": "query"})
        qrels.append({"id": f"q{index}", "relevant": item["relevant_docs"]})
    return entries, {
        "pin": source["pin"],
        "documentCount": len(chosen),
        "queryCount": len(selected),
        "droppedBeforeSelection": dropped,
        "qrels": qrels,
    }
