"""
Download and cache every model the engine uses, so the first request doesn't time out.
Model names come from detector_calibration.json (or the defaults in calibration.py).
"""
import calibration as cal


def download_all():
    from huggingface_hub import snapshot_download

    cfg = cal.load()
    m = cfg["models"]
    repos = []
    if m.get("desklib"):
        repos.append("desklib/ai-text-detector-v1.01")
    if m.get("roberta"):
        repos.append("openai-community/roberta-base-openai-detector")
    b = m.get("binoculars") or {}
    if b.get("enabled"):
        repos += [b["observer"], b["performer"]]
    repos.append(cfg["plagiarism"]["embedding_model"])
    for i, repo in enumerate(repos, 1):
        print(f"[{i}/{len(repos)}] {repo}")
        snapshot_download(repo, allow_patterns=["*.json", "*.safetensors", "*.txt", "*.model", "vocab*", "merges.txt", "1_Pooling/*"])
    print("All weights cached.")


if __name__ == "__main__":
    download_all()
