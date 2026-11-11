"""
Download and cache required models and NLTK data to ensure zero inference timeout.
"""
import sys
import nltk
from transformers import AutoTokenizer, AutoModelForSequenceClassification, GPT2LMHeadModel, GPT2Tokenizer
from sentence_transformers import SentenceTransformer

def download_all():
    print("[1/4] Downloading NLTK tokenizer models (punkt, punkt_tab)...")
    nltk.download('punkt', quiet=True)
    nltk.download('punkt_tab', quiet=True)
    print("NLTK data ready.")

    print("\n[2/4] Downloading & caching Transformer Classifier (roberta-base-openai-detector)...")
    model_name = "roberta-base-openai-detector"
    try:
        AutoTokenizer.from_pretrained(model_name)
        AutoModelForSequenceClassification.from_pretrained(model_name)
        print(f"Loaded {model_name} successfully.")
    except Exception as e:
        print(f"Could not load {model_name}: {e}. Falling back to desklib/ai-text-detector-v1.01...")
        fallback = "desklib/ai-text-detector-v1.01"
        AutoTokenizer.from_pretrained(fallback)
        AutoModelForSequenceClassification.from_pretrained(fallback)
        print(f"Loaded {fallback} successfully.")

    print("\n[3/4] Downloading & caching GPT-2 for perplexity and burstiness...")
    gpt2_name = "gpt2"
    GPT2Tokenizer.from_pretrained(gpt2_name)
    GPT2LMHeadModel.from_pretrained(gpt2_name)
    print(f"Loaded {gpt2_name} successfully.")

    print("\n[4/4] Downloading & caching SentenceTransformer (sentence-transformers/all-MiniLM-L6-v2)...")
    emb_name = "sentence-transformers/all-MiniLM-L6-v2"
    SentenceTransformer(emb_name)
    print(f"Loaded {emb_name} successfully.")

    print("\nAll weights and assets cached successfully!")

if __name__ == "__main__":
    download_all()

