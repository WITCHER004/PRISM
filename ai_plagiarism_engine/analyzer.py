import os
from ai_detector import AIDetectorModel
from plagiarism_detector import PlagiarismModel

class ArticleAnalyzer:
    """
    Unified Pipeline connecting AIDetectorModel and PlagiarismModel.
    Evaluates submitted text and outputs a structured result with clear verdict logic:
    - REJECT_PLAGIARISM: if plagiarism detected (high priority)
    - REJECT_AI: if AI probability is high (> 0.75)
    - MANUAL_REVIEW: if borderline AI probability (0.50 - 0.75) or moderate similarity
    - PASS: if original human content
    """
    def __init__(self, vector_dir: str = "./vector_index"):
        print("Initializing AI Detection Model...")
        self.ai_model = AIDetectorModel()
        print("Initializing Plagiarism Detection Model...")
        self.plagiarism_model = PlagiarismModel(persist_directory=vector_dir)
        print("Models initialized successfully.")

    def analyze_article(self, article_id: str, text: str) -> dict:
        # Run AI detection
        ai_res = self.ai_model.detect(text)

        # Run Plagiarism detection
        plagiarism_res = self.plagiarism_model.check_plagiarism(text, current_article_id=article_id)

        # Determine Verdict
        # Priority 1: Direct Plagiarism
        if plagiarism_res["is_plagiarized"] or plagiarism_res["overall_similarity_score"] >= 0.80:
            verdict = "REJECT_PLAGIARISM"
        # Priority 2: High AI Generation
        elif ai_res["is_ai_generated"] and ai_res["overall_ai_probability"] >= 0.75:
            verdict = "REJECT_AI"
        # Priority 3: Borderline / Manual Review
        elif (0.50 <= ai_res["overall_ai_probability"] < 0.75) or (0.60 <= plagiarism_res["overall_similarity_score"] < 0.80):
            verdict = "MANUAL_REVIEW"
        # Priority 4: Clean human article
        else:
            verdict = "PASS"

        return {
            "article_id": article_id,
            "verdict": verdict,
            "ai_detection": ai_res,
            "plagiarism_detection": plagiarism_res
        }

    def index_article(self, article_id: str, text: str):
        """
        Index an approved article into the plagiarism reference store.
        """
        self.plagiarism_model.add_to_index(article_id, text)

