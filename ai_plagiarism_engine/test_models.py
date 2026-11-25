"""
Engine test suite.

  python test_models.py          # fast unit checks (no model weights) + full-model integration checks
  python test_models.py --fast   # unit checks only

For accuracy numbers use the benchmark (../scripts/eval_detectors.py); these tests check behaviour.
"""
import os
import shutil
import sys
import tempfile

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import calibration as cal  # noqa: E402
from text_prep import detect_domain, prepare  # noqa: E402

SEED = (
    "Last summer, my brother and I packed our battered backpacks and decided on a whim to hike through "
    "the dense rain-soaked trails of the Pacific Northwest. We did not bring a GPS, relying only on a faded "
    "trail map given to us by an eccentric park ranger named Bill who lived in a cedar cabin. The mornings were "
    "freezing cold, and the smell of wet pine needles accompanied our daily routine of boiling instant black coffee "
    "over a sputtering camp stove."
)
HUMAN = (
    "I still remember the peculiar clang of my grandfather's antique grandfather clock every Sunday afternoon. "
    "It had a scratched mahogany veneer and carved lion paws for feet. We weren't allowed to play anywhere near it "
    "with tennis balls, but of course, my cousins and I did anyway, accidentally chipping the left corner in 1998. "
    "Whenever it chimed three, my grandmother would yell from the porch that tea was finally ready."
)
AI = (
    "It is important to note that artificial intelligence has become increasingly popular in recent years "
    "due to its ability to process vast amounts of data quickly and accurately. In addition, machine learning "
    "models are widely used across various industries, including healthcare, finance, and education, to automate "
    "repetitive tasks and optimize workflows. In conclusion, artificial intelligence continues to revolutionize modern "
    "industries by enhancing operational efficiency and driving automated decision-making. Furthermore, organizations "
    "must strategically adapt to harness the transformative potential of cognitive computing."
)


def unit():
    # Code is stripped before prose scoring
    p = prepare("Intro sentence here for the test.\n\n```python\nfor i in range(10):\n    print(i)\n```\n\nUse `len(xs)` to count.")
    assert p.code_blocks == 1 and "print" not in p.prose and "len(xs)" not in p.prose, p.prose
    # HTML code and blockquotes too
    p = prepare("<p>Prose.</p><pre><code>x = 1</code></pre><blockquote><p>A famous quoted line that is long enough.</p></blockquote><p>More prose here.</p>")
    assert "x = 1" not in p.prose and "famous" not in p.prose and p.excluded_quotes, p.prose
    # Attributed inline quotations are excluded; unattributed quotes stay
    p = prepare('As Orwell wrote, "political language is designed to make lies sound truthful and murder respectable" and it still holds.')
    assert "murder" not in p.prose and len(p.excluded_quotes) == 1, p.prose
    p = prepare('He called it "a sort of long grey tunnel with no end in sight at all" and left.')
    assert "tunnel" in p.prose
    # Domain from topic, then from content
    assert detect_domain(prepare("anything"), "programming") == ("programming", "topic")
    k8s = prepare("The kubernetes cluster lost a node, latency spiked, and the load balancer failed over to the replica in another region while autoscaling caught up.")
    assert detect_domain(k8s)[0] == "infrastructure"
    # Craft adjustment only moves borderline scores
    cfg = cal.load()
    craft = {"typedChars": 9000, "pastedChars": 200, "sessions": 4, "activeMs": 3 * 3600_000, "growth": [{"ms": 1, "words": 100}, {"ms": 2, "words": 600}, {"ms": 3, "words": 520}, {"ms": 4, "words": 900}]}
    assert cal.craft_adjust(21.0, craft, cfg)[0] < 21.0
    assert cal.craft_adjust(40.0, craft, cfg)[0] == 40.0
    pasted = {**craft, "typedChars": 300, "pastedChars": 9000}
    assert cal.craft_adjust(19.0, pasted, cfg)[0] > 19.0
    # Lexical plagiarism without any model
    from plagiarism_detector import PlagiarismDetector

    det = PlagiarismDetector(cfg, persist_directory=None, load_embeddings=False)
    det.index("seed", SEED, url="/someone/trails", title="Pacific trails")
    r = det.check(prepare(SEED.split(". ")[0] + ". " + HUMAN))
    assert r["plagiarismScore"] > 15 and r["matches"][0]["sourceUrl"] == "/someone/trails", r
    # Lightly edited copy still matches
    edited = SEED.replace("battered", "old").replace("eccentric", "odd")
    assert det.check(prepare(edited))["plagiarismScore"] > 50
    # Quoting the source with attribution is not plagiarism
    quoted = f"> {SEED}\n\n{HUMAN}"
    assert det.check(prepare(quoted))["plagiarismScore"] == 0
    assert det.check(prepare(HUMAN))["plagiarismScore"] == 0
    print("unit checks passed")


def integration():
    from analyzer import ArticleAnalyzer

    tmp = tempfile.mkdtemp(prefix="prism_test_")
    try:
        a = ArticleAnalyzer(vector_dir=tmp)
        a.index_article("art_corpus_001", SEED, url="/someone/trails", title="Pacific trails")

        r = a.analyze_article("t_ai", AI)
        print("AI sample:", r["overallAiScore"], r["confidenceLevel"], r["verdict"])
        assert r["overallAiScore"] > 20
        # 20–60 is routed to an employee instead of failing; above 60 fails outright
        assert r["verdict"] == ("REJECT_AI" if r["overallAiScore"] > 60 else "MANUAL_REVIEW")
        assert r["flaggedSentences"] and all("reason" in f for f in r["flaggedSentences"])

        r = a.analyze_article("t_human", HUMAN)
        print("human sample:", r["overallAiScore"], r["verdict"])
        assert r["plagiarismScore"] == 0

        r = a.analyze_article("t_copy", SEED)
        print("copied sample:", r["plagiarismScore"], r["verdict"])
        assert r["plagiarismScore"] > 15 and r["verdict"] == "REJECT_PLAGIARISM"
        assert any(f.get("plagiarismMatchUrl") == "/someone/trails" for f in r["flaggedSentences"])

        # Paraphrase (semantic layer): every content word changed
        para = (
            "A year ago, my sibling and I grabbed our worn-out rucksacks and impulsively chose to trek across the thick, "
            "rain-drenched paths of the Pacific Northwest. We left the GPS at home and depended solely on a washed-out map "
            "handed to us by a quirky forest ranger called Bill, who made his home in a cabin of cedar."
        )
        r = a.analyze_article("t_para", para)
        print("paraphrase:", r["plagiarismScore"], [f.get("matchType") for f in r["flaggedSentences"]])
        assert r["plagiarismScore"] > 15, r["plagiarism"]

        # Code-heavy tutorial: code must not count toward the AI score
        tut = HUMAN + "\n\n```js\nconst xs = [1, 2, 3].map((x) => x * 2)\nconsole.log(xs)\n```\n"
        r = a.analyze_article("t_code", tut, topic="programming")
        assert r["meta"]["codeBlocksStripped"] == 1 and r["detectedDomain"] == "programming"
        print("integration checks passed")
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


if __name__ == "__main__":
    unit()
    if "--fast" not in sys.argv:
        integration()
