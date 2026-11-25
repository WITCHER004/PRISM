"""
Signal 1 of the ensemble: transformer detectors.

  * Desklib  (desklib/ai-text-detector-v1.01, DeBERTa-v3-large, trained on modern LLM output)
  * RoBERTa  (roberta-base-openai-detector, GPT-2 era; kept as a complementary, weaker vote)
  * Binoculars (Hans et al., 2024): zero-shot ratio of the performer model's log-perplexity to the
    observer/performer cross-perplexity. Text that is "surprising" to both models in the same way
    (formal human prose) keeps a high score; LLM text drops low. This is what keeps careful human
    writing from being flagged just for being fluent.

Every model is optional and loaded on first use. If one can't load (missing weights, no memory) it
is reported as unavailable and the ensemble re-weights the others; the service never fails on it.
"""
from __future__ import annotations

import logging
import math
import os
import threading
from typing import Optional

log = logging.getLogger("prism.detectors")

_torch = None


def _t():
    global _torch
    if _torch is None:
        import torch  # imported lazily so the plagiarism-only path and tests start fast

        torch.set_grad_enabled(False)
        _torch = torch
    return _torch


def default_device() -> str:
    env = os.environ.get("DETECTOR_DEVICE")
    if env:
        return env
    return "cuda" if _t().cuda.is_available() else "cpu"


class _Lazy:
    name = "model"

    def __init__(self, device: Optional[str] = None):
        self.device = device or default_device()
        self._loaded = False
        self._error: Optional[str] = None
        self._lock = threading.Lock()

    @property
    def available(self) -> bool:
        self._ensure()
        return self._error is None

    @property
    def error(self) -> Optional[str]:
        return self._error

    def _ensure(self):
        if self._loaded:
            return
        with self._lock:
            if self._loaded:
                return
            try:
                self._load()
            except Exception as e:  # noqa: BLE001 - any load failure just disables this signal
                self._error = f"{type(e).__name__}: {e}"
                log.warning("%s unavailable: %s", self.name, self._error)
            self._loaded = True

    def _load(self):
        raise NotImplementedError


class DesklibDetector(_Lazy):
    name = "desklib/ai-text-detector-v1.01"

    def _load(self):
        torch = _t()
        from torch import nn
        from transformers import AutoConfig, AutoModel, AutoTokenizer, PreTrainedModel

        class DesklibAIDetectionModel(PreTrainedModel):
            config_class = AutoConfig

            def __init__(self, config):
                super().__init__(config)
                self.model = AutoModel.from_config(config)
                self.classifier = nn.Linear(config.hidden_size, 1)
                self.post_init()

            def forward(self, input_ids, attention_mask=None):
                hidden = self.model(input_ids, attention_mask=attention_mask)[0]
                mask = attention_mask.unsqueeze(-1).expand(hidden.size()).float()
                pooled = (hidden * mask).sum(1) / mask.sum(1).clamp(min=1e-9)
                return self.classifier(pooled)

        self.tok = AutoTokenizer.from_pretrained(self.name)
        self.model = DesklibAIDetectionModel.from_pretrained(self.name).to(self.device).eval()
        self._torch = torch

    def logits(self, texts: list[str], batch: int = 4) -> list[float]:
        """Raw logits (sigmoid → P(AI))."""
        self._ensure()
        if self._error:
            raise RuntimeError(self._error)
        out: list[float] = []
        for i in range(0, len(texts), batch):
            enc = self.tok(texts[i : i + batch], truncation=True, max_length=512, padding=True, return_tensors="pt").to(self.device)
            out.extend(self.model(enc["input_ids"], enc["attention_mask"]).squeeze(-1).float().cpu().tolist())
        return out


class RobertaDetector(_Lazy):
    name = "roberta-base-openai-detector"

    def _load(self):
        from transformers import AutoModelForSequenceClassification, AutoTokenizer

        name = self.name
        try:
            self.tok = AutoTokenizer.from_pretrained(name)
        except Exception:
            name = "openai-community/roberta-base-openai-detector"
            self.tok = AutoTokenizer.from_pretrained(name)
        self.model = AutoModelForSequenceClassification.from_pretrained(name).to(self.device).eval()
        self.ai_idx = 0  # {0: "Fake", 1: "Real"}
        for idx, label in (self.model.config.id2label or {}).items():
            if any(k in str(label).lower() for k in ("fake", "ai", "generated")):
                self.ai_idx = int(idx)

    def logits(self, texts: list[str], batch: int = 8) -> list[float]:
        """Log-odds of the AI class."""
        self._ensure()
        if self._error:
            raise RuntimeError(self._error)
        torch = _t()
        out: list[float] = []
        for i in range(0, len(texts), batch):
            enc = self.tok(texts[i : i + batch], truncation=True, max_length=512, padding=True, return_tensors="pt").to(self.device)
            lp = torch.log_softmax(self.model(**enc).logits.float(), dim=-1)
            ai = lp[:, self.ai_idx]
            other = torch.logsumexp(torch.cat([lp[:, : self.ai_idx], lp[:, self.ai_idx + 1 :]], dim=-1), dim=-1)
            out.extend((ai - other).cpu().tolist())
        return out


class Binoculars(_Lazy):
    """observer = base model, performer = its instruction-tuned sibling (must share a tokenizer)."""

    def __init__(self, observer: str, performer: str, device: Optional[str] = None, max_tokens: int = 512):
        super().__init__(device)
        self.observer_name = observer
        self.performer_name = performer
        self.name = f"binoculars({observer} / {performer})"
        self.max_tokens = max_tokens

    def _load(self):
        torch = _t()
        from transformers import AutoModelForCausalLM, AutoTokenizer

        dtype = torch.bfloat16 if self.device.startswith("cuda") else torch.float32
        self.tok = AutoTokenizer.from_pretrained(self.observer_name)
        if self.tok.pad_token is None:
            self.tok.pad_token = self.tok.eos_token
        self.observer = AutoModelForCausalLM.from_pretrained(self.observer_name, dtype=dtype).to(self.device).eval()
        self.performer = AutoModelForCausalLM.from_pretrained(self.performer_name, dtype=dtype).to(self.device).eval()

    def scores(self, texts: list[str], batch: int = 2) -> list[float]:
        """Binoculars score per text. Lower = more machine-like (paper threshold ≈0.90 for Falcon-7B)."""
        self._ensure()
        if self._error:
            raise RuntimeError(self._error)
        torch = _t()
        out: list[float] = []
        for i in range(0, len(texts), batch):
            enc = self.tok(texts[i : i + batch], truncation=True, max_length=self.max_tokens, padding=True, return_tensors="pt").to(self.device)
            obs = self.observer(**enc).logits[:, :-1].float()
            perf = self.performer(**enc).logits[:, :-1].float()
            target = enc["input_ids"][:, 1:]
            mask = enc["attention_mask"][:, 1:].float()
            # log-perplexity of the text under the performer
            nll = torch.nn.functional.cross_entropy(perf.transpose(1, 2), target, reduction="none")
            ppl = (nll * mask).sum(1) / mask.sum(1).clamp(min=1)
            # cross-perplexity: observer's distribution scored by the performer's log-probs
            x = -(torch.softmax(obs, -1) * torch.log_softmax(perf, -1)).sum(-1)
            xppl = (x * mask).sum(1) / mask.sum(1).clamp(min=1)
            out.extend((ppl / xppl.clamp(min=1e-6)).cpu().tolist())
        return out


def logit(p: float, eps: float = 1e-4) -> float:
    p = min(1 - eps, max(eps, p))
    return math.log(p / (1 - p))


def sigmoid(z: float) -> float:
    if z >= 0:
        return 1 / (1 + math.exp(-z))
    e = math.exp(z)
    return e / (1 + e)
