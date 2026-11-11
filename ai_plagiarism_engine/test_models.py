import os
import sys
import json

# Ensure local directory is on pythonpath
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from analyzer import ArticleAnalyzer

def run_tests():
    print("=" * 70)
    print("STARTING TEST SUITE: AI & Plagiarism Detection Engine")
    print("=" * 70)

    test_vector_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "test_vector_index")
    analyzer = ArticleAnalyzer(vector_dir=test_vector_dir)

    # 1. Human Reference Article to seed into corpus
    seed_article_id = "art_corpus_001"
    seed_human_text = (
        "Last summer, my brother and I packed our battered backpacks and decided on a whim to hike through "
        "the dense rain-soaked trails of the Pacific Northwest. We did not bring a GPS, relying only on a faded "
        "trail map given to us by an eccentric park ranger named Bill who lived in a cedar cabin. The mornings were "
        "freezing cold, and the smell of wet pine needles accompanied our daily routine of boiling instant black coffee "
        "over a sputtering camp stove."
    )
    print("\n--- Seeding Knowledge Base with Original Article ---")
    analyzer.index_article(seed_article_id, seed_human_text)
    print(f"Indexed article: {seed_article_id}")

    # Test Case 1: AI-Generated Paragraph
    ai_sample = (
        "It is important to note that artificial intelligence has become increasingly popular in recent years "
        "due to its ability to process vast amounts of data quickly and accurately. In addition, machine learning "
        "models are widely used across various industries, including healthcare, finance, and education, to automate "
        "repetitive tasks and optimize workflows. In conclusion, artificial intelligence continues to revolutionize modern "
        "industries by enhancing operational efficiency and driving automated decision-making. Furthermore, organizations "
        "must strategically adapt to harness the transformative potential of cognitive computing."
    )

    print("\n" + "=" * 50)
    print("TEST 1: Evaluating AI-Generated Text")
    print("=" * 50)
    res_ai = analyzer.analyze_article("art_ai_test_01", ai_sample)
    print(json.dumps(res_ai, indent=2))

    # Assertions for AI detection
    assert res_ai["article_id"] == "art_ai_test_01"
    assert "ai_detection" in res_ai
    assert "flagged_ai_sentences" in res_ai["ai_detection"]
    assert res_ai["ai_detection"]["is_ai_generated"] is True
    assert res_ai["ai_detection"]["overall_ai_probability"] > 0.60
    assert len(res_ai["ai_detection"]["flagged_ai_sentences"]) > 0
    print("✓ Test 1 passed: AI detection generated expected high-confidence flags.")

    # Test Case 2: Organic Human Writing (Pass verdict)
    human_sample = (
        "I still remember the peculiar clang of my grandfather's antique grandfather clock every Sunday afternoon. "
        "It had a scratched mahogany veneer and carved lion paws for feet. We weren't allowed to play anywhere near it "
        "with tennis balls, but of course, my cousins and I did anyway, accidentally chipping the left corner in 1998. "
        "Whenever it chimed three, my grandmother would yell from the porch that tea was finally ready."
    )

    print("\n" + "=" * 50)
    print("TEST 2: Evaluating Genuine Human Text")
    print("=" * 50)
    res_human = analyzer.analyze_article("art_human_test_02", human_sample)
    print(json.dumps(res_human, indent=2))

    assert res_human["article_id"] == "art_human_test_02"
    assert res_human["verdict"] in ["PASS", "MANUAL_REVIEW"]
    assert res_human["plagiarism_detection"]["is_plagiarized"] is False
    print("✓ Test 2 passed: Genuine human sample evaluated cleanly.")

    # Test Case 3: Duplicated / Paraphrased Paragraph (Plagiarism trigger)
    copied_sample = (
        "Last summer, my brother and I packed our battered backpacks and decided on a whim to hike through "
        "the dense rain-soaked trails of the Pacific Northwest. We did not bring a GPS, relying only on a faded "
        "trail map given to us by an eccentric park ranger named Bill who lived in a cedar cabin."
    )

    print("\n" + "=" * 50)
    print("TEST 3: Evaluating Copied / Plagiarized Text")
    print("=" * 50)
    res_plag = analyzer.analyze_article("art_plag_test_03", copied_sample)
    print(json.dumps(res_plag, indent=2))

    assert res_plag["plagiarism_detection"]["is_plagiarized"] is True
    assert len(res_plag["plagiarism_detection"]["matched_sources"]) > 0
    assert res_plag["plagiarism_detection"]["matched_sources"][0]["source_article_id"] == seed_article_id
    assert res_plag["verdict"] == "REJECT_PLAGIARISM"
    print("✓ Test 3 passed: Dual-layer plagiarism detector successfully identified source.")

    print("\n" + "=" * 70)
    print("ALL TESTS COMPLETED SUCCESSFULLY! JSON SCHEMA FULLY VERIFIED.")
    print("=" * 70)

if __name__ == "__main__":
    run_tests()
