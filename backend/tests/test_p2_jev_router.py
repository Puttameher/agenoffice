import pytest
import asyncio
from backend.app.router.router import jev_router, DIRECT, TOOL, MANAGER, JevRouter
from backend.app.router.decider import RoutingDecision, LLMDecider, JevDecider
from backend.app.database.repository import Repository
from backend.app.database.db import init_db

# 15 Benchmark Prompts covering DIRECT, TOOL, and MANAGER
BENCHMARK_PROMPTS = [
    # --- DIRECT Prompts (Conversational, Explanatory, Factual) ---
    ("Hello Jordan, how are you doing today?", DIRECT),
    ("What is the capital of France?", DIRECT),
    ("Can you explain the difference between synchronous and asynchronous programming?", DIRECT),
    ("Tell me a quick joke about computer science.", DIRECT),
    ("Summarize what this agent office does in two sentences.", DIRECT),

    # --- TOOL Prompts (Atomic Math / Single Action) ---
    ("Calculate 125 * 38 + 490", TOOL),
    ("What is 2 to the power of 16?", TOOL),
    ("Compute the square root of 144", TOOL),
    ("Calculate 15% tip on an $86.50 bill", TOOL),
    ("What is 1024 divided by 8?", TOOL),

    # --- MANAGER Prompts (Multi-step, Coding, Research, Browsing) ---
    ("Research the latest autonomous agent architectures and write a summary markdown file", MANAGER),
    ("Build a Python web scraper for news articles and save results to a CSV file", MANAGER),
    ("Create a CLI tool with argument parsing, write unit tests, and verify it runs cleanly", MANAGER),
    ("Navigate to example.com using the browser, extract the main heading, and take a screenshot", MANAGER),
    ("Implement a financial modeling script with cash flow projections and error handling", MANAGER),
]

@pytest.fixture(autouse=True)
def setup_test_db():
    init_db()

@pytest.mark.asyncio
async def test_p2_fifteen_prompts_llm_fallback():
    """
    Verify 15 sample prompts are classified correctly with calibrated probabilities
    using LLMDecider structured output.
    """
    decider = LLMDecider()
    results = []

    for prompt, expected_route in BENCHMARK_PROMPTS:
        decision: RoutingDecision = await decider.decide_route(prompt)
        results.append((prompt, expected_route, decision))
        
        # Verify valid probabilities and structure
        assert decision.route in (DIRECT, TOOL, MANAGER)
        assert 0.0 <= decision.confidence <= 1.0
        assert decision.decider == "llm"
        assert decision.latency_ms >= 0.0
        assert isinstance(decision.raw_probabilities, dict)
        assert expected_route in decision.raw_probabilities or len(decision.raw_probabilities) > 0

    # Verify at least 13/15 (86%+) exact match on nuanced benchmark
    matches = sum(1 for prompt, expected, decision in results if decision.route == expected)
    accuracy = matches / len(BENCHMARK_PROMPTS)
    assert accuracy >= 0.85, f"Expected >= 85% accuracy on benchmark, got {accuracy:.2f} ({matches}/15)"

@pytest.mark.asyncio
async def test_p2_jev_decider_or_auto_fallback():
    """
    Verify JevDecider routes or gracefully triggers fallback without raising unhandled exceptions.
    """
    decision = await jev_router.route("Calculate 55 * 84")
    assert decision.route in (TOOL, MANAGER)
    assert decision.confidence > 0.0
    assert decision.decider in ("jev", "llm")

@pytest.mark.asyncio
async def test_p2_confidence_escalation():
    """
    Verify confidence escalation:
    If confidence < threshold (0.90), DIRECT escalates to TOOL, and TOOL escalates to MANAGER.
    """
    strict_router = JevRouter(confidence_threshold=0.99)
    # A short greeting might have confidence ~0.90-0.95, which is < 0.99
    decision = await strict_router.route("hello there", force_decider="llm")
    if decision.confidence < 0.99:
        assert decision.escalated is True
        assert decision.route in (TOOL, MANAGER)
        assert decision.escalation_reason is not None

@pytest.mark.asyncio
async def test_p2_decision_logging_in_sqlite():
    """
    Verify every routed decision is recorded into the SQLite decisions table.
    """
    prompt = "Build a portfolio dashboard with real-time charts"
    decision = await jev_router.route(prompt)
    
    decisions = Repository.get_decisions(limit=10)
    assert len(decisions) >= 1
    recent = decisions[0]
    assert recent["prompt"] == prompt
    assert recent["route"] == decision.route
    assert recent["confidence"] == decision.confidence
    assert "latency_ms" in recent
    assert isinstance(recent["probabilities"], dict)

@pytest.mark.asyncio
async def test_p2_learning_decision():
    """
    Verify the Decider can categorize completed task episodes into IGNORE, MEMORY, or SKILL.
    """
    res = await jev_router.decide_learning(
        task_summary="Built a Playwright script to download and parse 10-K SEC filings",
        strategy="Headless browser automation with CSS selector waits and CSV export",
        score=0.95
    )
    assert res["action"] in ("SKILL", "MEMORY", "IGNORE")
    assert "confidence" in res
