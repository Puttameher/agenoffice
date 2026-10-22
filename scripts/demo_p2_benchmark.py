import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import asyncio
import json
from backend.app.router.router import jev_router, DIRECT, TOOL, MANAGER
from backend.app.database.db import init_db
from backend.app.database.repository import Repository

BENCHMARK_PROMPTS = [
    # 5 DIRECT prompts
    ("Hello Jordan, how are you doing today?", DIRECT),
    ("What is the capital of France?", DIRECT),
    ("Can you explain the difference between synchronous and asynchronous programming?", DIRECT),
    ("Tell me a quick joke about computer science.", DIRECT),
    ("Summarize what this agent office does in two sentences.", DIRECT),

    # 5 TOOL prompts
    ("Calculate 125 * 38 + 490", TOOL),
    ("What is 2 to the power of 16?", TOOL),
    ("Compute the square root of 144", TOOL),
    ("Calculate 15% tip on an $86.50 bill", TOOL),
    ("What is 1024 divided by 8?", TOOL),

    # 5 MANAGER prompts
    ("Research the latest autonomous agent architectures and write a summary markdown file", MANAGER),
    ("Build a Python web scraper for news articles and save results to a CSV file", MANAGER),
    ("Create a CLI tool with argument parsing, write unit tests, and verify it runs cleanly", MANAGER),
    ("Navigate to example.com using the browser, extract the main heading, and take a screenshot", MANAGER),
    ("Implement a financial modeling script with cash flow projections and error handling", MANAGER),
]

async def run_benchmark():
    init_db()
    print("=" * 85)
    print("PHASE 2 PROOF: JEV ROUTER 15-PROMPT BENCHMARK & CLASSIFICATION")
    print("=" * 85)
    print(f"{'#':<3} | {'Expected':<7} | {'Routed':<7} | {'Conf':<5} | {'Decider':<6} | {'Latency':<7} | {'Prompt':<40}")
    print("-" * 85)

    correct = 0
    total = len(BENCHMARK_PROMPTS)

    for idx, (prompt, expected) in enumerate(BENCHMARK_PROMPTS, 1):
        decision = await jev_router.route(prompt)
        is_match = decision.route == expected
        if is_match:
            correct += 1
        
        match_symbol = "[OK]" if is_match else "[FAIL]"
        short_prompt = prompt[:38] + ".." if len(prompt) > 38 else prompt
        print(f"{idx:<3} | {expected:<7} | {decision.route:<7} | {decision.confidence:<5.2f} | {decision.decider:<6} | {decision.latency_ms:<5.0f}ms | {short_prompt:<40} {match_symbol}")
        print(f"    Probabilities: {json.dumps(decision.raw_probabilities)} | Escalated: {decision.escalated}")

    accuracy = (correct / total) * 100
    print("-" * 85)
    print(f"BENCHMARK ACCURACY: {correct}/{total} ({accuracy:.1f}%)")
    print("=" * 85)

    # Verify SQLite Persistence
    print("\nRECENT DECISIONS LOGGED TO SQLITE:")
    records = Repository.get_decisions(limit=3)
    for r in records:
        print(f"- ID: {r['id']} | Hash: {r['input_hash']} | Route: {r['route']} | Conf: {r['confidence']:.2f} | Decider: {r['decider']} | Latency: {r['latency_ms']:.1f}ms")
        print(f"  Prompt: {r['prompt'][:60]}...")
        print(f"  Probabilities: {json.dumps(r['probabilities'])}")

    print("\n" + "=" * 85)
    print("PHASE 2 PROOF COMPLETED SUCCESSFULLY")
    print("=" * 85)

if __name__ == "__main__":
    asyncio.run(run_benchmark())
