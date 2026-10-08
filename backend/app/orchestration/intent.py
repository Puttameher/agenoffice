"""
intent.py — Task classification and intent analyzer.

Classifies incoming requests into one of 9 internal task categories:
  - answer: greetings, general conversational questions, simple chit-chat
  - explain: requests for tutorials, conceptual explanations, 'how does X work'
  - build: creating new code, applications, scripts, repositories from scratch
  - modify: refactoring, updating, patching, or adding features to existing code
  - execute: running code, terminal commands, or mathematical calculations
  - research: finding documents, company policies, deep literature synthesis
  - analyze: inspecting datasets, code audits, quantitative evaluations
  - automate: scheduled workflows, web form automation, bots
  - create_artifact: producing standalone deliverables (charts, documents, reports)

Also detects continuation intents ('go on', 'continue', 'build it', 'do it').
"""

import re
from typing import Literal

TaskCategory = Literal[
    "answer",
    "explain",
    "build",
    "modify",
    "execute",
    "research",
    "analyze",
    "automate",
    "create_artifact",
]

IntentType = Literal["action", "conversational"]

_CONTINUATION_SIGNALS = {
    "go on", "continue", "build it", "do it", "proceed",
    "keep going", "run it", "make it", "create it", "yes do it",
    "execute it", "please do it", "go ahead"
}

_CONVERSATIONAL_SIGNALS = {
    "hi", "hello", "hey", "thanks", "thank you", "good morning",
    "good evening", "how are you", "what's up", "who are you",
    "nice", "great", "awesome", "cool",
}

_EXPLAIN_SIGNALS = {
    "how do i", "how can i", "how to", "how does", "how do", "how would",
    "what is", "what are", "what was", "what were",
    "explain", "describe", "tell me about", "tell me how",
    "why does", "why is", "what does", "what happens",
    "can you explain", "help me understand", "what would",
    "should i", "could you tell", "walk me through"
}


def is_continuation(user_input: str) -> bool:
    """Returns True if the user is signaling to continue/execute a previous task."""
    text = user_input.strip().lower()
    # Normalize punctuation
    text = re.sub(r"[^\w\s]", "", text).strip()
    return text in _CONTINUATION_SIGNALS or any(sig == text for sig in _CONTINUATION_SIGNALS)


def classify_task(user_input: str) -> TaskCategory:
    """
    Classify a user request into one of the 9 core task categories.
    """
    text = user_input.strip().lower()

    # 1. Greetings & short conversational chitchat
    if len(text.split()) <= 3 and any(sig in text for sig in _CONVERSATIONAL_SIGNALS):
        return "answer"

    # 2. Explanations & Conceptual Questions
    for phrase in _EXPLAIN_SIGNALS:
        if text.startswith(phrase) or f" {phrase}" in text:
            # If user explicitly asks "how to build" or "explain how to build", it's explain, not build
            return "explain"

    # 3. Modification & Editing
    if re.search(r"\b(modify|refactor|update|edit|patch|change|rewrite|fix bug|debug|add feature|extend)\b", text):
        return "modify"

    # 4. Automate
    if re.search(r"\b(automate|automation|cron|schedule|bot|pipeline)\b", text):
        return "automate"

    # 5. Create Artifact (deliverable charts, reports, documents)
    if re.search(r"\b(create artifact|generate chart|plot|create report|generate report|diagram)\b", text):
        return "create_artifact"

    # 6. Build / Creation (Code, Applications, Scripts)
    if re.search(r"\b(build|create|make|code|implement|develop|scaffold|construct|write|generate|produce)\b", text):
        return "build"

    # 7. Execution / Calculation — explicit keywords
    if re.search(r"\b(run|execute|calculate|compute|eval|launch|start|boot|test|verify)\b", text):
        return "execute"

    # 7b. Inline math expression detection — e.g. "whats 3+2", "100 * 5", "2**10"
    #     Pattern: digit(s) [operator] digit(s), possibly with 'whats', 'what is', etc.
    if re.search(r"[\d\.]+\s*[\+\-\*\/\%\^]{1,2}\s*[\d\.]+", text):
        return "execute"

    # 7c. Conversational math questions: "what is 3 plus 2", "compute 5 times 3"
    if re.search(r"\b(plus|minus|times|divided by|multiplied by|mod|modulo|power of|squared|cubed)\b", text):
        return "execute"

    # 8. Research / Document retrieval
    if re.search(r"\b(research|investigate|search company|find policy|working hours|handbook|stack|guideline)\b", text):
        return "research"

    # 9. Analysis (data/code analysis)
    if re.search(r"\b(analyze|analysis|audit|statistics|breakdown|evaluate metrics)\b", text):
        return "analyze"

    # Default fallback
    return "answer"


def is_execution_category(cat: TaskCategory, user_input: str = "") -> bool:
    """
    Returns True if the category represents an actionable task that requires
    workspace creation, tool invocation, and execution verification.
    """
    if cat in ("build", "modify", "execute", "automate", "create_artifact"):
        return True
    if cat == "analyze":
        # Data / quantitative / code analysis is execution; conceptual advice is not
        text = user_input.lower()
        if any(w in text for w in ["data", "code", "csv", "number", "metric", "stat", "performance", "return"]):
            return True
        return False
    return False


def classify_intent(user_input: str) -> IntentType:
    """
    Legacy / compatibility wrapper:
    Returns 'action' for execution tasks, 'conversational' otherwise.
    """
    cat = classify_task(user_input)
    return "action" if is_execution_category(cat, user_input) else "conversational"


def is_action(user_input: str) -> bool:
    """Convenience wrapper — returns True if the input is an action task."""
    return classify_intent(user_input) == "action"
