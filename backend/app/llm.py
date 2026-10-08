import json
import re
import asyncio
from typing import Any, Dict, List, Optional
from pydantic import BaseModel
from backend.app.config import settings

class SimulatedLLM:
    """
    Intelligent simulated LLM provider for zero-cost, local-first execution.
    Handles agent extraction, task solving, evaluation, and experience generation.
    """
    def invoke(self, prompt: str) -> str:
        prompt_lower = prompt.lower()

        # 0. Router classification
        if "routing classifier" in prompt_lower or "classify the user message into exactly one route" in prompt_lower:
            msg_match = re.search(r'User message:\s*"?(.*?)"?\s*$', prompt, re.DOTALL | re.IGNORECASE)
            msg_text = msg_match.group(1).strip() if msg_match else prompt
            msg_low = msg_text.lower()

            agent_words = ["build", "create", "implement", "write", "develop", "code", "program", "scaffold", "make a", "generate a", "fix", "debug", "refactor", "automate", "research"]
            if any(w in msg_low for w in agent_words):
                return json.dumps({
                    "route": "agent",
                    "tool": None,
                    "reason": "Task requires multi-step planning, coding, or specialist agent execution.",
                    "confidence": 0.95
                })

            if any(w in msg_low for w in ["calculate", "compute", "weather", "time in", "gmail"]) or re.search(r"\d\s*[\+\-\*\/]\s*\d", msg_low):
                tool_name = "calculator" if (any(w in msg_low for w in ["calculate", "compute"]) or re.search(r"\d\s*[\+\-\*\/]\s*\d", msg_low)) else "weather"
                return json.dumps({
                    "route": "tool",
                    "tool": tool_name,
                    "reason": "Single standalone tool execution.",
                    "confidence": 0.95
                })

            return json.dumps({
                "route": "chat",
                "tool": None,
                "reason": "Direct conversational inquiry or explanation.",
                "confidence": 0.95
            })
        
        # 1. Agent extraction from NL prompt
        if "extract agent configuration" in prompt_lower or "structured configuration" in prompt_lower:
            name_match = re.search(r"create\s+([A-Za-z0-9_]+)", prompt, re.IGNORECASE)
            name = name_match.group(1) if name_match else "Specialist"
            
            role = "General Assistant"
            skills = ["problem solving", "analysis"]
            tools = ["calculator"]
            
            if "python" in prompt_lower or "coding" in prompt_lower or "debug" in prompt_lower:
                role = "Python Coding Specialist"
                skills = ["Python", "debugging", "algorithm design"]
                tools = ["python_runner", "calculator"]
            elif "finance" in prompt_lower or "financial" in prompt_lower or "account" in prompt_lower:
                role = "Financial Analyst"
                skills = ["financial modeling", "budgeting", "data analysis"]
                tools = ["calculator"]
            elif "research" in prompt_lower or "search" in prompt_lower or "investigat" in prompt_lower:
                role = "Research Analyst"
                skills = ["literature review", "fact extraction", "synthesis"]
                tools = ["calculator"]
                
            return json.dumps({
                "name": name,
                "role": role,
                "description": f"{name} is an AI agent specializing in {role.lower()}.",
                "instructions": f"Act as a professional {role}. Analyze requests carefully and deliver concise, correct answers.",
                "skills": skills,
                "tools": tools,
                "permanent": True,
                "memory_enabled": True
            })

        # 2. Orchestration decision (must be an actual routing request, not conversational reply)
        if ("route options:" in prompt_lower or "decide how to route" in prompt_lower or "assignment decision" in prompt_lower):
            # Isolate the user task from the prompt to avoid matching keywords in instructions or route options
            task_match = re.search(r'User Task:\s*\n?["\']?(.*?)(?:["\']?\s*\n(?:Route options|Routing Rules|Provide|Return|\Z))', prompt, re.DOTALL | re.IGNORECASE)
            task_text = task_match.group(1).strip() if task_match else prompt
            task_lower = task_text.lower()

            need_rag = any(w in task_lower for w in ["policy", "policies", "guideline", "guidelines", "stack", "handbook", "working hours"])
            
            # Check if user explicitly asked for temp agent (clinical, diet, medical, crypto, tax, hire, spawn)
            if any(w in task_lower for w in ["create agent", "hire agent", "new agent", "spawn agent", "diet", "clinical", "medical", "crypto", "tax"]):
                return json.dumps({
                    "route": "create_temporary_agent",
                    "action": "create_temporary_agent",
                    "missing_capability": "Specialized Domain Task",
                    "need_rag": need_rag,
                    "reason": "User requested new specialized agent creation."
                })

            # Check collaboration / swarm (strictly from user task text)
            if any(w in task_lower for w in ["collaborat", "swarm", "pair", "team review", "together"]):
                return json.dumps({
                    "route": "collaborative_swarm",
                    "action": "select_existing_agent",
                    "selected_agent_id": "agent_rio",
                    "need_rag": need_rag,
                    "reason": "Collaborative maker-checker deliberation requested."
                })

            # Check if specialized tool execution (Python code sandbox, math calculation, building website, forms)
            if any(w in task_lower for w in ["python", "script", "code", "runner", "calculate", "compound", "interest", "fibonacci", "build website", "website", "form", "fill"]):
                return json.dumps({
                    "route": "delegate_to_agent",
                    "action": "select_existing_agent",
                    "selected_agent_id": "agent_alex" if any(w in task_lower for w in ["python", "script", "code", "website", "runner", "fibonacci"]) else "agent_rio",
                    "need_rag": need_rag,
                    "reason": "Task requires specialized interactive tool execution in the sandbox."
                })

            # Check if specific agent was mentioned in user task
            for ag in ["alex", "rio", "nova", "jordan", "mika", "taylor"]:
                if ag in task_lower:
                    return json.dumps({
                        "route": "delegate_to_agent",
                        "action": "select_existing_agent",
                        "selected_agent_id": f"agent_{ag}",
                        "need_rag": need_rag,
                        "reason": f"User explicitly directed task to {ag.title()}."
                    })

            # If RAG is needed, delegate to an agent to synthesize docs
            if need_rag:
                return json.dumps({
                    "route": "delegate_to_agent",
                    "action": "select_existing_agent",
                    "selected_agent_id": "agent_alex",
                    "need_rag": True,
                    "reason": "Company policy / documentation retrieval required."
                })

            # Otherwise: direct orchestrator!
            return json.dumps({
                "route": "direct_orchestrator",
                "action": "direct_orchestrator",
                "need_rag": False,
                "reason": "Conversational inquiry / conceptual question; Orchestrator answers directly."
            })

        # 3. Evaluation decision
        if "evaluator" in prompt_lower or "evaluate task result" in prompt_lower:
            return json.dumps({
                "success": True,
                "score": 0.95,
                "reason": "The solution is complete, directly addresses the prompt, and contains valid calculations/logic."
            })

        # 4. Experience summarizer
        if "experience summarizer" in prompt_lower:
            return json.dumps({
                "task_summary": "Handled user request effectively with clear steps and verified results.",
                "strategy": "Understood requirements, applied appropriate tools/retrieval, and validated response format.",
                "what_worked": "Direct structured output and step-by-step problem breakdown.",
                "what_failed": "None observed during this run.",
                "lesson": "Continue checking edge cases and providing clear explanations of assumptions."
            })

        # 4b. Peer Reviewer sign-off
        if "peer reviewer" in prompt_lower or "peer audit" in prompt_lower or "peer review sign-off" in prompt_lower:
            return "I have completed the peer review. The implementation logic, boundary handling, and test verifications are confirmed robust with zero defects."

        # 4c. Direct Orchestrator / Manager conversational response
        is_orch_prompt = (
            "you are the ai office orchestrator" in prompt_lower
            or "you are jordan" in prompt_lower
            or "ai office manager" in prompt_lower
            or "jordan:" in prompt_lower
        )
        if is_orch_prompt:
            req_match = re.search(r'(?:User Request|User Task|User):\s*\n?["\']?(.*?)(?:["\']?\s*(?:\nProvide|\nJordan:|\n\n|\Z))', prompt, re.DOTALL | re.IGNORECASE)
            req_text = req_match.group(1).strip() if req_match else ""
            if not req_text:
                lines = [l.strip() for l in prompt.split("\n") if l.strip()]
                req_text = lines[-1] if lines else prompt
            req_lower = req_text.lower()

            words = set(re.findall(r"\b\w+\b", req_lower))

            # Check-ins like "how u doing", "how are you", "how's it going", "what's up"
            if any(q in req_lower for q in ["how u doing", "how you doing", "how are you", "how r u", "hows it going", "how's it going", "how are things", "how is it going", "what's up", "whats up", "wassup"]):
                return "Doing great, thanks for asking! I'm Jordan, your AI office manager. The whole team (Alex, Rio, Nova, Mika, Zane, Taylor) is online and ready. What can we help you build or analyze today?"

            # Identity / Who are you
            if any(w in req_lower for w in ["who are you", "what is your name", "who r u", "introduce yourself"]):
                return "I'm Jordan, the AI Office Manager. I oversee our autonomous specialist team: Alex (coding), Rio (finance & data), Nova (research), Mika (content), Zane (automation), and Taylor (operations). What can we work on together?"

            # Greetings like "hi", "hello", "hey", "good morning", "good evening", "sup", "yo"
            greeting_words = {"hi", "hello", "hey", "sup", "yo", "hiya", "howdy", "greetings"}
            if (words & greeting_words) or any(g in req_lower for g in ["good morning", "good afternoon", "good evening"]):
                return "Hey! I'm Jordan, your office manager. Our team can build code, run scripts, crunch numbers, write docs, or research anything. What do you need today?"

            # Gratitude
            if any(t in req_lower for t in ["thank you", "thanks", "thx", "appreciate it"]):
                return "You're very welcome! Let me know whenever you need anything else built, researched, or analyzed."

            # Inline math shortcut — evaluate directly before any other check
            math_match = re.search(r"([\d\.]+)\s*([\+\-\*\/\%\^]{1,2})\s*([\d\.]+)", req_text)
            if math_match:
                import ast as _ast
                try:
                    safe_expr = req_text.replace("^", "**")
                    # Only allow safe math chars
                    clean_expr = re.sub(r"[^0-9\.\+\-\*\/\%\(\)\s\*]", "", safe_expr).strip()
                    if clean_expr:
                        val = _ast.literal_eval(str(eval(clean_expr, {"__builtins__": None}, {})))  # noqa
                        clean = str(int(val)) if isinstance(val, float) and val.is_integer() else str(val)
                        return f"{clean_expr} = **{clean}**"
                except Exception:
                    pass

            # Conceptual / explanation questions
            if any(q in req_lower for q in ["how does", "what is", "what are", "difference between", "explain", "describe", "tell me about", "why does", "how do"]):
                if "tkinter" in req_lower:
                    return "Tkinter is Python's built-in GUI toolkit. It provides widgets (Button, Entry, Label, Canvas), layout managers (grid, pack, place), and a main event loop via `.mainloop()`. It ships with Python on all platforms — no install needed."
                elif "tuple" in req_lower and "list" in req_lower:
                    return "Lists (`[]`) are mutable — you can append, remove, or reassign items. Tuples (`()`) are immutable — once created they can't change, making them hashable and usable as dict keys. Use lists when you need to modify the collection; use tuples for fixed data like coordinates or records."
                elif "langgraph" in req_lower or "langchain" in req_lower:
                    return "LangGraph is a library by LangChain for building stateful, multi-step agent workflows as directed graphs. Each node is a function that reads/writes typed state; edges (including conditional ones) control flow between nodes. It powers this office's orchestration — each task flows through orchestrator → RAG → agent execution → evaluation → memory nodes."
                elif "async" in req_lower or "asyncio" in req_lower:
                    return "Python's `asyncio` lets you run I/O-bound tasks concurrently without threads. You define coroutines with `async def`, pause them with `await`, and run them with `asyncio.run()`. It's ideal for network requests, file I/O, and web servers — like this FastAPI backend."
                elif "rag" in req_lower or "retrieval" in req_lower:
                    return "RAG (Retrieval-Augmented Generation) grounds LLM answers in real documents. The system embeds your docs into a vector store, retrieves the top-k closest chunks for each query, and injects them into the prompt so the model answers from your actual data rather than hallucinating."
                else:
                    # Generic explain — give a real answer based on the topic
                    topic = req_text[:80].strip()
                    return f"Good question about {topic}. This touches on core software engineering principles. The key idea is breaking the problem into well-defined components, each with clear inputs and outputs, and composing them reliably. If you want a deeper dive or a working implementation, just ask and I'll have Alex or the team build it."

            # Capability / what can you do
            if any(q in req_lower for q in ["what can you do", "what can this", "capabilities", "help me", "what do you"]):
                return """Here's what the office can do for you:

• **Build** — write Python scripts, CLI tools, web APIs, data pipelines, games
• **Calculate** — run math, financial models, compound interest, statistics
• **Execute** — run code in the sandbox, capture stdout/stderr, fix errors
• **Research** — query company docs via RAG, synthesize information
• **Analyze** — inspect data, audit code, evaluate metrics
• **Automate** — create scheduled workflows, bots, pipelines
• **Collaborate** — spin up a multi-agent swarm with peer review
• **Hire** — spawn a temporary specialist agent for any domain

Just type what you need and the team will handle it."""

            # Status / office info
            if any(q in req_lower for q in ["status", "office"]):
                return "All systems operational. Agents are on standby: Alex (coding), Rio (analysis), Nova (research), Mika (content), Zane (automation), Taylor (operations). Give us a task and we'll get to work."

            # Gibberish / very short / unrecognized — but only if it doesn't contain numbers/operators
            has_math = bool(re.search(r"[\d\+\-\*\/\^]", req_text))
            if (len(req_text.split()) <= 2 or not any(c.isalpha() for c in req_text)) and not has_math:
                return f"I didn't quite catch that — could you rephrase? I can help you build software, run calculations, research topics, or coordinate the team."

            # Catch-all for anything else — give a direct, helpful response
            return f"Got it. Regarding '{req_text[:120]}', I'm ready to help. If this is something you want built or executed, just say 'build it' or 'run it' and I'll dispatch it to the right agent. What direction would you like to take?"

        # 5. Agent Task Solver
        if "user task:" in prompt_lower or "act as a professional" in prompt_lower or "you are" in prompt_lower:
            # Check if this prompt is specifically asking to generate Python code
            if "writing complete, working python code" in prompt_lower or "wrap the code in a ```python" in prompt_lower:
                if "calculator" in prompt_lower:
                    return """```python
# calculator.py - GUI Calculator with standalone arithmetic logic engine
import sys

class CalculatorEngine:
    @staticmethod
    def add(a, b): return a + b

    @staticmethod
    def subtract(a, b): return a - b

    @staticmethod
    def multiply(a, b): return a * b

    @staticmethod
    def divide(a, b):
        if b == 0:
            raise ZeroDivisionError("Cannot divide by zero")
        return a / b

    @staticmethod
    def evaluate(expression: str):
        allowed = set("0123456789+-*/. ()")
        if not all(c in allowed for c in expression):
            raise ValueError("Invalid character in expression")
        return eval(expression, {"__builtins__": None}, {})

def create_gui():
    try:
        import tkinter as tk
        root = tk.Tk()
        root.title("GUI Calculator")
        root.geometry("320x420")
        root.resizable(False, False)

        entry_var = tk.StringVar()
        entry = tk.Entry(root, textvariable=entry_var, font=("Arial", 20), justify="right", bd=10)
        entry.grid(row=0, column=0, columnspan=4, padx=10, pady=10)

        def click(btn):
            if btn == "=":
                try:
                    res = CalculatorEngine.evaluate(entry_var.get())
                    entry_var.set(str(res))
                except ZeroDivisionError:
                    entry_var.set("Error: Div by 0")
                except Exception:
                    entry_var.set("Error")
            elif btn == "C":
                entry_var.set("")
            else:
                entry_var.set(entry_var.get() + str(btn))

        buttons = [
            ("7", 1, 0), ("8", 1, 1), ("9", 1, 2), ("/", 1, 3),
            ("4", 2, 0), ("5", 2, 1), ("6", 2, 2), ("*", 2, 3),
            ("1", 3, 0), ("2", 3, 1), ("3", 3, 2), ("-", 3, 3),
            ("0", 4, 0), (".", 4, 1), ("=", 4, 2), ("+", 4, 3),
            ("C", 5, 0),
        ]

        for (text, r, c) in buttons:
            w = 8 if text != "C" else 36
            cs = 1 if text != "C" else 4
            b = tk.Button(root, text=text, width=w, height=2, font=("Arial", 12), command=lambda t=text: click(t))
            b.grid(row=r, column=c, columnspan=cs, padx=2, pady=2)

        return root
    except Exception as e:
        print(f"Headless environment: {e}")
        return None

if __name__ == "__main__":
    assert CalculatorEngine.add(10, 5) == 15, "Addition test failed"
    assert CalculatorEngine.subtract(10, 5) == 5, "Subtraction test failed"
    assert CalculatorEngine.multiply(10, 5) == 50, "Multiplication test failed"
    assert CalculatorEngine.divide(10, 5) == 2.0, "Division test failed"
    try:
        CalculatorEngine.divide(10, 0)
        assert False, "Divide by zero should raise ZeroDivisionError"
    except ZeroDivisionError:
        pass
    print("All calculator tests verified successfully.")
```"""
                elif "fibonacci" in prompt_lower or "fib" in prompt_lower:
                    return """```python
def fibonacci(n):
    a, b = 0, 1
    seq = []
    for _ in range(n):
        seq.append(a)
        a, b = b, a + b
    return seq

if __name__ == "__main__":
    nums = fibonacci(10)
    for x in nums:
        print(x)
```"""
                elif "password" in prompt_lower:
                    return """```python
import string
import random

def generate_password(length=16):
    chars = string.ascii_letters + string.digits + string.punctuation
    return "".join(random.choice(chars) for _ in range(length))

if __name__ == "__main__":
    pwd = generate_password()
    print(f"Generated password: {pwd}")
```"""
                else:
                    # Generic task code generation — produce a working Python script
                    task_match_code = re.search(r"Task:\s*\n?(.*?)\n", prompt, re.DOTALL | re.IGNORECASE)
                    task_name = task_match_code.group(1).strip()[:60] if task_match_code else "task"
                    slug = re.sub(r"[^a-z0-9_]", "_", task_name.lower())[:30]
                    return f"""```python
# {slug}.py — auto-generated implementation

def run():
    print("Task '{task_name}' executed successfully.")
    return {{"status": "ok", "task": "{task_name}"}}

if __name__ == "__main__":
    result = run()
    print(result)
```"""

            task_match = re.search(r"(?:User Task|User Request|User):\s*\n?[\"']?(.*?)(?:[\"']?\s*(?:\n\n|\nProvide|\nJordan:|\Z)|\Z)", prompt, re.DOTALL | re.IGNORECASE)
            user_task = task_match.group(1).strip() if task_match else ""
            task_l = user_task.lower()

            # Conversational greetings in agent solver
            if any(q in task_l for q in ["how u doing", "how you doing", "how are you", "how r u", "hows it going", "how's it going", "what's up", "whats up"]):
                return "Doing great, thanks for asking! I'm Jordan, your AI office manager. What can we help you build or analyze today?"
            if any(g in task_l for g in ["hi", "hello", "hey"]):
                return "Hey! I'm Jordan, your office manager. What would you like us to work on today?"

            # ── Agent synthesis prompt (after build tasks): produce a plain natural summary
            # The agent synthesis prompt always starts with "You are {name}, working as a"
            # and asks for a "concise, professional summary"
            if "write a concise, professional summary" in prompt_lower or "concise, professional summary" in prompt_lower:
                # Extract files_created from the prompt
                files_match = re.search(r"Files created:\s*\n((?:  •.*\n?)+)", prompt)
                files_str = ""
                if files_match:
                    files_str = files_match.group(1).strip()
                files = [f.strip().lstrip("•").strip() for f in files_str.split("\n") if f.strip()]

                # Extract test results
                test_match = re.search(r"Test results:\s*\n(.*?)(?:\n\nErrors|\nTool output|\nWrite|\Z)", prompt, re.DOTALL)
                tests_raw = test_match.group(1).strip() if test_match else ""
                test_lines = [t.strip() for t in tests_raw.split("\n") if t.strip() and t.strip() != "(no tests run)"]

                if files:
                    t_low = user_task.lower() if user_task else prompt_lower
                    if "calculator" in t_low:
                        headline = "Built the calculator."
                    elif "fibonacci" in t_low:
                        headline = "Generated the fibonacci script."
                    elif "password" in t_low:
                        headline = "Built the password generator."
                    elif "todo" in t_low:
                        headline = "Built the to-do list app."
                    elif "snake" in t_low or "game" in t_low:
                        headline = "Built the game."
                    else:
                        m = re.search(r"(?:build|create|make|implement|write|generate)\s+(?:a\s+|an\s+)?([a-z\s0-9_-]{2,30})", t_low)
                        noun = m.group(1).strip() if m else "project"
                        headline = f"Built the {noun}."

                    lines_out = [headline, ""]
                    lines_out.append("Created:")
                    for f in files:
                        lines_out.append(f"• {f}")
                    if test_lines:
                        lines_out.append("")
                        lines_out.append("Tested:")
                        for t in test_lines:
                            t_clean = t.replace("✅", "").replace("❌", "").replace("•", "").strip()
                            if t_clean:
                                lines_out.append(f"• {t_clean}")
                    return "\n".join(lines_out)
                else:
                    # Non-file build summary
                    return f"Completed: {user_task[:120]}" if user_task else "Task completed."

            # ── Calculator tool output in prompt — return the plain numeric answer
            calc_match = re.search(r"\[Tool: calculator\]\s*(.*?)\s*=\s*([\d\.\-]+)", prompt)
            if calc_match:
                calc_expr = calc_match.group(1).strip()
                calc_val = calc_match.group(2).strip()
                clean_val = str(int(float(calc_val))) if (calc_val.replace('.', '', 1).isdigit() and float(calc_val).is_integer()) else calc_val
                return f"{calc_expr} = **{clean_val}**"

            # ── Inline math question (no tool output yet)
            simple_math = re.search(r"(\d[\d\s\+\-\*\/\^\(\)\.]+\d)", user_task)
            if simple_math and any(op in user_task for op in ["+", "-", "*", "/", "^", "**"]):
                try:
                    expr = simple_math.group(1).strip().replace("^", "**")
                    result_val = eval(expr, {"__builtins__": None}, {})
                    clean = str(int(result_val)) if isinstance(result_val, float) and result_val.is_integer() else str(result_val)
                    return f"{expr} = **{clean}**"
                except Exception:
                    pass

            # ── Code / script tasks
            if any(w in task_l for w in ["python", "code", "script", "function", "algorithm", "api", "bug", "fix", "debug"]):
                if "fibonacci" in task_l or "fib" in task_l:
                    return """```python
def fibonacci(n):
    a, b = 0, 1
    seq = []
    for _ in range(n):
        seq.append(a)
        a, b = b, a + b
    return seq

if __name__ == "__main__":
    print(fibonacci(10))
```"""
                elif "password" in task_l:
                    return """```python
import string, random
def generate_password(length=16):
    chars = string.ascii_letters + string.digits + string.punctuation
    return "".join(random.choice(chars) for _ in range(length))

if __name__ == "__main__":
    print(generate_password())
```"""
                else:
                    return f"Here's a working implementation for: {user_task[:80]}\n\n```python\ndef solution():\n    pass  # implement here\n\nif __name__ == '__main__':\n    solution()\n```"

            # ── Finance / quantitative
            if any(w in task_l for w in ["compound", "interest", "finance", "revenue", "budget", "cost", "invest", "roi", "profit"]):
                return f"For '{user_task[:80]}': compound interest is calculated as A = P(1 + r/n)^(nt). Run `/calc` or ask me to write a Python script for exact projections."

            # ── Research / strategy
            if any(w in task_l for w in ["research", "market", "competitor", "strategy", "trend", "analyse", "analyze"]):
                return f"Research task noted: '{user_task[:120]}'. I'll have Nova retrieve relevant sources and synthesize the findings. Want me to kick that off now?"

            # ── Generic agent response — natural language, no boilerplate headers
            if user_task:
                return f"Understood: {user_task[:200]}. I've reviewed the requirements. Let me know if you want me to proceed with implementation, run a calculation, or do further research."
            return "I'm ready to help! Let me know what you'd like me or the team to build, research, or calculate."

        # Default fallback response
        return "I have processed the request according to the assigned instructions and verified the result."


# Available providers and model catalogs (OpenRouter & OpenAI)
PROVIDER_CATALOG = {
    "openrouter": {
        "name": "OpenRouter",
        "default_base_url": "https://openrouter.ai/api/v1",
        "models": [
            {"id": "nousresearch/hermes-3-llama-3.1-70b", "name": "Hermes 3 70B", "badge": "Nous", "tag": "Recommended", "desc": "Frontier reasoning & uncensored intelligence"},
            {"id": "nousresearch/hermes-3-llama-3.1-405b", "name": "Hermes 3 405B", "badge": "Ultra", "tag": "Flagship", "desc": "Massive 405B parameter scale for deep synthesis"},
            {"id": "anthropic/claude-3.5-sonnet", "name": "Claude 3.5 Sonnet", "badge": "Anthropic", "tag": "Elite Code", "desc": "Leading coding, visual & architectural reasoning"},
            {"id": "deepseek/deepseek-r1", "name": "DeepSeek R1", "badge": "Reasoning", "tag": "Chain-of-Thought", "desc": "Open reasoning powerhouse with internal monologue"},
            {"id": "meta-llama/llama-3.3-70b-instruct", "name": "Llama 3.3 70B", "badge": "Meta", "tag": "Instruction", "desc": "Flagship instruction-tuned open weights"},
            {"id": "openai/gpt-4o", "name": "GPT-4o (OpenRouter)", "badge": "OpenAI", "tag": "Omni", "desc": "Multimodal flagship via OpenRouter"},
            {"id": "openai/gpt-4o-mini", "name": "GPT-4o Mini (OpenRouter)", "badge": "Fast", "tag": "Economy", "desc": "Rapid, low-latency execution"}
        ]
    },
    "openai": {
        "name": "OpenAI Direct",
        "default_base_url": "https://api.openai.com/v1",
        "models": [
            {"id": "gpt-4o-mini", "name": "GPT-4o Mini", "badge": "Fast", "tag": "Recommended", "desc": "High speed, economical responses"},
            {"id": "gpt-4o", "name": "GPT-4o", "badge": "Flagship", "tag": "Omnimodel", "desc": "Flagship multimodal intelligence"},
            {"id": "o3-mini", "name": "o3-mini", "badge": "Reasoning", "tag": "STEM & Logic", "desc": "High-throughput STEM deliberation"},
            {"id": "o1", "name": "o1", "badge": "Deep Thought", "tag": "Full Reasoning", "desc": "Maximum multi-step reasoning capabilities"}
        ]
    }
}

# Legacy mapping for backwards-compatibility
PRESET_MODELS = {
    "gpt-4o-mini": {"id": "gpt-4o-mini", "name": "OpenAI GPT-4o Mini", "provider": "openai", "default_base_url": "https://api.openai.com/v1"},
    "gpt-4o": {"id": "gpt-4o", "name": "OpenAI GPT-4o", "provider": "openai", "default_base_url": "https://api.openai.com/v1"},
    "hermes-3-openrouter": {"id": "nousresearch/hermes-3-llama-3.1-70b", "name": "Hermes 3 (OpenRouter)", "provider": "openrouter", "default_base_url": "https://openrouter.ai/api/v1"},
    "openrouter": {"id": "nousresearch/hermes-3-llama-3.1-70b", "name": "OpenRouter", "provider": "openrouter", "default_base_url": "https://openrouter.ai/api/v1"},
    "openai": {"id": "gpt-4o-mini", "name": "OpenAI Direct", "provider": "openai", "default_base_url": "https://api.openai.com/v1"}
}

class LLMRuntimeConfig:
    def __init__(self):
        self.api_key = settings.OPENAI_API_KEY
        self.base_url = settings.OPENAI_BASE_URL
        self.model_name = settings.OPENAI_MODEL_NAME or "nousresearch/hermes-3-llama-3.1-70b"

        # Auto-detect initial provider from base_url or key
        if self.base_url and "openrouter" in self.base_url.lower() or (self.api_key and "sk-or-" in self.api_key):
            self.provider = "openrouter"
        else:
            self.provider = "openai" if (self.api_key and not "openrouter" in (self.base_url or "")) else "openrouter"

    def get_provider(self) -> str:
        if self.base_url:
            if "openrouter" in self.base_url.lower():
                return "openrouter"
            if "api.openai.com" in self.base_url.lower() or "openai" in self.base_url.lower():
                return "openai"
            if "localhost" in self.base_url or "127.0.0.1" in self.base_url:
                return "ollama"
        if self.api_key and "sk-or-" in self.api_key:
            return "openrouter"
        return getattr(self, "provider", "openrouter")

    @property
    def preset_key(self) -> str:
        return self.get_provider()

    def update(self, preset_key: Optional[str] = None, provider: Optional[str] = None,
               model_name: Optional[str] = None, api_key: Optional[str] = None, 
               base_url: Optional[str] = None):
        target_provider = provider or preset_key
        if target_provider and target_provider in PROVIDER_CATALOG:
            self.provider = target_provider
            prov = PROVIDER_CATALOG[target_provider]
            if not base_url:
                self.base_url = prov["default_base_url"]
            if not model_name:
                self.model_name = prov["models"][0]["id"]
        elif target_provider and target_provider in PRESET_MODELS:
            preset = PRESET_MODELS[target_provider]
            self.model_name = preset["id"]
            if not base_url:
                self.base_url = preset["default_base_url"]
            self.provider = preset["provider"]

        if model_name:
            self.model_name = model_name
            # If switching to an OpenRouter or OpenAI model, align provider and base_url
            for p_key, p_val in PROVIDER_CATALOG.items():
                if any(m["id"] == model_name for m in p_val["models"]):
                    self.provider = p_key
                    if not base_url:
                        self.base_url = p_val["default_base_url"]
                    break

        if api_key is not None:
            self.api_key = api_key
        if base_url is not None:
            self.base_url = base_url

    def is_connected(self) -> bool:
        active_base = self.base_url or ""
        if "localhost" in active_base or "127.0.0.1" in active_base:
            return True
        return bool(self.api_key and len(self.api_key.strip()) > 5)

    def to_dict(self):
        connected = self.is_connected()
        prov_key = self.get_provider()
        prov_data = PROVIDER_CATALOG.get(prov_key, PROVIDER_CATALOG["openrouter"])
        
        # Determine model display name
        active_meta = next((m for m in prov_data["models"] if m["id"] == self.model_name), None)
        if not active_meta:
            other_key = "openai" if prov_key == "openrouter" else "openrouter"
            active_meta = next((m for m in PROVIDER_CATALOG[other_key]["models"] if m["id"] == self.model_name), None)
        
        display_name = active_meta["name"] if active_meta else self.model_name

        return {
            "provider": prov_key,
            "provider_name": prov_data["name"],
            "model_name": self.model_name,
            "model_display_name": display_name,
            "base_url": self.base_url,
            "has_api_key": bool(self.api_key and len(self.api_key.strip()) > 3),
            "is_connected": connected,
            "mode": "live" if connected else "sandbox",
            "status_message": f"Live Engine Connected ({display_name})" if connected else "No API key connected. Running in Offline Sandbox Mode.",
            "masked_key": f"sk-...{self.api_key[-4:]}" if (self.api_key and len(self.api_key) > 6) else ("Connected" if self.api_key else ""),
            "available_models": prov_data["models"],
            "all_providers": [
                {
                    "key": k,
                    "name": v["name"],
                    "default_base_url": v["default_base_url"],
                    "models": v["models"]
                }
                for k, v in PROVIDER_CATALOG.items()
            ],
            # Legacy compatibility
            "preset_key": prov_key,
            "presets": [
                {"key": k, "name": v["name"], "id": v["models"][0]["id"], "provider": k, "default_base_url": v["default_base_url"]}
                for k, v in PROVIDER_CATALOG.items()
            ]
        }

llm_config = LLMRuntimeConfig()

def get_llm(model_name: Optional[str] = None, api_key: Optional[str] = None, base_url: Optional[str] = None, max_tokens: Optional[int] = None):
    """
    Returns ChatOpenAI configured with active model & endpoint, or falls back to SimulatedLLM.
    Supports OpenAI, Hermes (via OpenRouter or Ollama), and custom OpenAI-compatible endpoints.
    """
    active_key = api_key if api_key is not None else llm_config.api_key
    active_base = base_url if base_url is not None else llm_config.base_url
    active_model = model_name if model_name is not None else llm_config.model_name

    # Local Ollama doesn't strictly need a key, default to 'ollama'
    if active_base and ("localhost" in active_base or "127.0.0.1" in active_base):
        if not active_key:
            active_key = "ollama"

    if active_key:
        try:
            from langchain_openai import ChatOpenAI
            extra_headers = {}
            if active_base and "openrouter" in active_base.lower():
                extra_headers = {
                    "HTTP-Referer": "http://localhost:8000",
                    "X-Title": "Agent Office"
                }
            return ChatOpenAI(
                model=active_model,
                api_key=active_key,
                base_url=active_base or None,
                temperature=0.2,
                max_tokens=max_tokens or 350,
                default_headers=extra_headers or None
            )
        except Exception as e:
            print(f"[LLM] Warning: Could not initialize ChatOpenAI ({e}). Falling back to SimulatedLLM.")
            return SimulatedLLM()
    return SimulatedLLM()

def is_live_connected() -> bool:
    """Returns True if a live API key or local Ollama engine is configured."""
    return llm_config.is_connected()

async def test_llm_connection(preset_key: Optional[str] = None, api_key: Optional[str] = None, 
                              base_url: Optional[str] = None, model_name: Optional[str] = None) -> Dict[str, Any]:
    """Production-grade verification testing for live LLM connectivity."""
    target_preset = preset_key or llm_config.preset_key
    target_key = api_key if api_key is not None else llm_config.api_key
    target_base = base_url if base_url is not None else llm_config.base_url
    target_model = model_name if model_name is not None else llm_config.model_name

    if target_preset in PRESET_MODELS:
        preset = PRESET_MODELS[target_preset]
        if not target_base:
            target_base = preset["default_base_url"]
        if not target_model:
            target_model = preset["id"]

    # 1. Local Ollama check
    if target_base and ("localhost" in target_base or "127.0.0.1" in target_base):
        try:
            import urllib.request
            req = urllib.request.Request(f"{target_base.rstrip('/v1')}/api/tags", headers={"User-Agent": "AgentOffice"})
            with urllib.request.urlopen(req, timeout=2.5) as resp:
                if resp.status == 200:
                    return {
                        "success": True,
                        "connected": True,
                        "provider": "ollama",
                        "message": f"Connected to Local Ollama instance! Model: {target_model}"
                    }
        except Exception:
            return {
                "success": False,
                "connected": False,
                "provider": "ollama",
                "message": f"Could not reach Ollama at {target_base}. Ensure Ollama is running (`ollama serve`)."
            }

    # 2. Key existence check
    if not target_key or len(target_key.strip()) < 5:
        return {
            "success": False,
            "connected": False,
            "mode": "sandbox",
            "message": "⚠️ No API key connected. Running in Simulated Sandbox Mode. Connect an OpenAI or OpenRouter API key to activate live LLM execution."
        }

    # 3. Live call verification
    try:
        from langchain_openai import ChatOpenAI
        from langchain_core.messages import HumanMessage
        extra_headers = {}
        if target_base and "openrouter" in target_base.lower():
            extra_headers = {
                "HTTP-Referer": "http://localhost:8000",
                "X-Title": "Agent Office"
            }
        client = ChatOpenAI(
            model=target_model,
            api_key=target_key,
            base_url=target_base or None,
            max_tokens=15,
            timeout=10.0,
            default_headers=extra_headers or None
        )
        await asyncio.to_thread(client.invoke, [HumanMessage(content="ping")])
        return {
            "success": True,
            "connected": True,
            "model": target_model,
            "message": f"Successfully authenticated and connected to {target_model}!"
        }
    except Exception as e:
        err_str = str(e)
        if "401" in err_str or "Incorrect API key" in err_str or "unauthorized" in err_str.lower():
            return {
                "success": False,
                "connected": False,
                "message": "Authentication failed (401 Unauthorized): Invalid API key."
            }
        elif "402" in err_str or "credit" in err_str.lower() or "payment" in err_str.lower():
            return {
                "success": False,
                "connected": False,
                "message": "Credit limit reached (402). Add credits at your provider or use Sandbox mode."
            }
        elif "429" in err_str or "quota" in err_str.lower():
            return {
                "success": False,
                "connected": False,
                "message": "Rate limit or quota reached (429). Check your account balance."
            }
        elif "404" in err_str or "not found" in err_str.lower():
            return {
                "success": False,
                "connected": False,
                "message": f"Model '{target_model}' not found on endpoint (404)."
            }
        return {
            "success": False,
            "connected": False,
            "message": f"Connection error: {err_str[:120]}"
        }

def llm_generate(prompt: str, model_name: Optional[str] = None, max_tokens: Optional[int] = None) -> str:
    """Helper to query the active LLM (OpenAI, Hermes, Ollama) or SimulatedLLM."""
    client = get_llm(model_name=model_name, max_tokens=max_tokens)
    if isinstance(client, SimulatedLLM):
        return client.invoke(prompt)
    
    try:
        from langchain_core.messages import HumanMessage
        res = client.invoke([HumanMessage(content=prompt)])
        out = res.content if hasattr(res, 'content') else str(res)
        # Clean multi-turn continuation echoes if generated by model
        if "\nJordan:" in out:
            out = out.split("\nJordan:")[0].strip()
        if "\nUser:" in out:
            out = out.split("\nUser:")[0].strip()
        return out.strip()
    except Exception as e:
        print(f"[LLM] Live call failed ({e}), using SimulatedLLM fallback.")
        return SimulatedLLM().invoke(prompt)


