import math
import numpy as np
import torch
import nltk
from transformers import AutoTokenizer, AutoModelForSequenceClassification, GPT2LMHeadModel, GPT2Tokenizer

class AIDetectorModel:
    """
    Hybrid Ensemble AI-Generated Text Detector:
    - 70% Transformer Classifier (roberta-base-openai-detector) with 350-word sliding window and 175-word stride.
    - 30% Statistical Linguistics (GPT-2 perplexity & burstiness).
    - Sentence-level flagging based on low perplexity (< 35.0) and high AI probability.
    """
    def __init__(self, device: str = None):
        if device is None:
            self.device = "cuda" if torch.cuda.is_available() else "cpu"
        else:
            self.device = device

        # Ensure nltk tokenizers
        try:
            nltk.data.find('tokenizers/punkt_tab')
        except LookupError:
            nltk.download('punkt_tab', quiet=True)
            nltk.download('punkt', quiet=True)

        # 1. Transformer Classifier
        self.classifier_name = "roberta-base-openai-detector"
        self.clf_tokenizer = AutoTokenizer.from_pretrained(self.classifier_name)
        self.clf_model = AutoModelForSequenceClassification.from_pretrained(self.classifier_name).to(self.device)
        self.clf_model.eval()

        # Label index for 'Fake' (AI-generated)
        # roberta-base-openai-detector: {0: 'Fake', 1: 'Real'}
        self.ai_label_idx = 0
        if hasattr(self.clf_model.config, 'id2label'):
            for idx, label in self.clf_model.config.id2label.items():
                if "fake" in label.lower() or "ai" in label.lower() or "generated" in label.lower():
                    self.ai_label_idx = int(idx)
                    break

        # 2. Perplexity Model (GPT-2)
        self.gpt2_name = "gpt2"
        self.gpt2_tokenizer = GPT2Tokenizer.from_pretrained(self.gpt2_name)
        self.gpt2_model = GPT2LMHeadModel.from_pretrained(self.gpt2_name).to(self.device)
        self.gpt2_model.eval()

    def _split_sentences(self, text: str) -> list[str]:
        sentences = nltk.sent_tokenize(text.strip())
        return [s.strip() for s in sentences if s.strip()]

    def _calculate_perplexity(self, text: str, max_length: int = 512) -> float:
        """
        Calculate Perplexity (PPL) using GPT-2 cross-entropy loss.
        """
        encodings = self.gpt2_tokenizer(text, return_tensors="pt")
        input_ids = encodings.input_ids.to(self.device)
        seq_len = input_ids.size(1)

        if seq_len <= 1:
            return 999.0

        if seq_len > max_length:
            input_ids = input_ids[:, :max_length]

        with torch.no_grad():
            outputs = self.gpt2_model(input_ids, labels=input_ids)
            loss = outputs.loss
            try:
                ppl = math.exp(loss.item())
                if math.isnan(ppl) or math.isinf(ppl):
                    return 999.0
                return ppl
            except OverflowError:
                return 999.0

    def _predict_chunk_prob(self, text: str) -> float:
        """
        Predict probability of being AI-generated for a single text chunk.
        """
        if not text.strip():
            return 0.0
        inputs = self.clf_tokenizer(
            text,
            return_tensors="pt",
            truncation=True,
            max_length=512,
            padding=True
        ).to(self.device)
        with torch.no_grad():
            logits = self.clf_model(**inputs).logits
            probs = torch.softmax(logits, dim=-1)[0]
            ai_prob = probs[self.ai_label_idx].item()
        return float(ai_prob)

    def _sliding_window_classifier(self, text: str, window_size: int = 350, stride: int = 175) -> float:
        """
        Sliding window of 350 words with 175-word stride across full text.
        """
        words = text.split()
        if len(words) <= window_size:
            return self._predict_chunk_prob(text)

        chunk_probs = []
        for i in range(0, len(words), stride):
            chunk_words = words[i:i + window_size]
            chunk_text = " ".join(chunk_words)
            prob = self._predict_chunk_prob(chunk_text)
            chunk_probs.append(prob)
            if i + window_size >= len(words):
                break

        return float(np.mean(chunk_probs)) if chunk_probs else 0.0

    def detect(self, text: str) -> dict:
        """
        Runs hybrid detection and returns exact schema elements.
        """
        cleaned_text = text.strip()
        if not cleaned_text:
            return {
                "is_ai_generated": False,
                "overall_ai_probability": 0.0,
                "transformer_score": 0.0,
                "perplexity_score": 999.0,
                "burstiness_std": 0.0,
                "flagged_ai_sentences": []
            }

        sentences = self._split_sentences(cleaned_text)

        # 1. Transformer Classifier Score (Sliding window)
        transformer_score = self._sliding_window_classifier(cleaned_text, window_size=350, stride=175)

        # 2. Perplexity & Burstiness Calculation
        doc_perplexity = self._calculate_perplexity(cleaned_text)

        sentence_perplexities = []
        sentence_lengths = []
        sentence_details = []

        for sent in sentences:
            # Word length
            w_len = len(sent.split())
            sentence_lengths.append(w_len)

            # Perplexity
            s_ppl = self._calculate_perplexity(sent)
            sentence_perplexities.append(s_ppl)

            # Sentence AI confidence
            s_ai_conf = self._predict_chunk_prob(sent)
            sentence_details.append({
                "sentence": sent,
                "ai_Confidence": round(s_ai_conf, 2),
                "perplexity": round(s_ppl, 1)
            })

        # Burstiness score: standard deviation of sentence perplexities and sentence lengths
        if len(sentence_perplexities) > 1:
            burstiness_ppl_std = float(np.std(sentence_perplexities))
            burstiness_len_std = float(np.std(sentence_lengths))
            # Average std dev across perplexity and sentence length
            burstiness_std = float((burstiness_ppl_std + burstiness_len_std) / 2.0)
        else:
            burstiness_std = 0.0

        # Statistical AI Score derivation from PPL and Burstiness
        # AI text typically exhibits lower perplexity (< 45) and lower burstiness variance (< 15)
        # Perplexity factor: PPL <= 25 -> 1.0, PPL >= 90 -> 0.0
        ppl_ai_prob = max(0.0, min(1.0, (90.0 - doc_perplexity) / 65.0))
        # Burstiness factor: burstiness <= 8 -> 1.0, burstiness >= 30 -> 0.0
        burstiness_ai_prob = max(0.0, min(1.0, (30.0 - burstiness_std) / 22.0))
        statistical_ai_score = 0.6 * ppl_ai_prob + 0.4 * burstiness_ai_prob

        # Ensemble: 70% Transformer Classifier, 30% Statistical Linguistics
        overall_ai_probability = (0.70 * transformer_score) + (0.30 * statistical_ai_score)
        overall_ai_probability = max(0.0, min(1.0, overall_ai_probability))

        # Sentence-Level Flagging: Low perplexity (< 35.0) and high AI probability (or prominent classifier fake probability)
        flagged_sentences = []
        for s_info in sentence_details:
            if s_info["perplexity"] < 35.0 or (s_info["perplexity"] < 40.0 and s_info["ai_Confidence"] >= 0.40):
                flagged_sentences.append(s_info)

        is_ai_generated = bool(overall_ai_probability >= 0.55)

        return {
            "is_ai_generated": is_ai_generated,
            "overall_ai_probability": round(overall_ai_probability, 2),
            "transformer_score": round(transformer_score, 2),
            "perplexity_score": round(doc_perplexity, 1),
            "burstiness_std": round(burstiness_std, 1),
            "flagged_ai_sentences": flagged_sentences
        }

