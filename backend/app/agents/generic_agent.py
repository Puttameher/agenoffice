"""
generic_agent.py — One reusable agent implementation that actually executes tasks.

The agent follows this loop:
  UNDERSTAND → INSPECT → PLAN → WRITE FILES → RUN → TEST → FIX → RETURN RESULT

Key behaviors:
- For action/build tasks: generates REAL code from the task description (not hard-coded samples)
- Writes generated files to the task workspace via WorkspaceManager
- Runs the code via python_runner and captures actual stdout/stderr
- On failure: inspects the error and fixes the code (up to max_fix_attempts)
- Returns structured ExecutionResult metadata (files_created, commands_run, tests, errors)
"""

import re
import json
from typing import Dict, Any, Optional, List, Tuple

from backend.app.models.schemas import AgentConfig
from backend.app.tools.registry import tool_registry
from backend.app.memory.memory_store import memory_store
from backend.app.llm import llm_generate
from backend.app.orchestration.intent import is_action

MAX_FIX_ATTEMPTS = 2


def _extract_code_block(text: str) -> Optional[str]:
    """Extract the first fenced code block from LLM output.
    Returns only the code inside the block, stripping any surrounding prose.
    """
    # Primary: ```python\n...\n``` or unclosed ```python\n...
    match = re.search(r"```(?:python|py)?\s*\n([\s\S]*?)(?:```|\Z)", text)
    if match and match.group(1).strip():
        code = match.group(1).strip()
        lines = [l for l in code.splitlines() if l.strip()]
        if any(l.startswith(("import ", "from ", "def ", "class ", "#", "print(", "    ")) for l in lines):
            return code

    # Fallback: treat the whole text as code only if it looks purely like Python
    lines = [l for l in text.splitlines() if l.strip()]
    if not lines:
        return None
    code_indicators = sum(
        1 for l in lines
        if l.startswith(("import ", "from ", "def ", "class ", "    ", "#", "print(", "for ", "if ", "return ", "while "))
    )
    # Only treat as raw code if >60% of lines look like Python (avoids prose fallback)
    if code_indicators / len(lines) > 0.6:
        return text.strip()
    return None


def _generate_code_for_task(task_input: str, agent_name: str, agent_role: str,
                              error_context: str = "") -> str:
    """
    Ask the LLM to generate ACTUAL implementation code for the task.
    Returns the raw LLM output (code will be extracted separately).
    """
    fix_instruction = ""
    if error_context:
        fix_instruction = f"""
The previous attempt produced this error:
{error_context}

Fix the code to resolve this error. Return the complete corrected implementation.
"""

    prompt = f"""You are {agent_name}, a {agent_role}.
Your job is to implement the following task by writing complete, working Python code.

Task:
{task_input}
{fix_instruction}

Rules:
- Write complete, self-contained Python code that actually solves the task.
- Do NOT use tkinter, pygame, or any GUI library (headless execution only).
- If the task mentions GUI/visual interface, implement a text/terminal version instead.
- Import only standard library modules (no pip installs needed).
- Include a demonstration / test run at the bottom that exercises the main functionality.
- Wrap the code in a ```python ... ``` fenced block.
- Do NOT explain the code — just write it.
"""
    return llm_generate(prompt)


class GenericAgent:
    """
    ONE reusable generic agent implementation.
    Operates strictly from its AgentConfig, dynamically bound tools,
    persistent agent memories, and contextual experiences.
    """
    def __init__(self, config: AgentConfig):
        self.config = config

    def execute(
        self,
        task_input: str,
        rag_context: Optional[str] = None,
        past_experiences: Optional[str] = None,
        workspace_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Executes a task using the agent's instructions, available tools,
        injected RAG/experience context, and workspace file writing.

        For action tasks (build/create/run/calculate):
          - Generates actual code dynamically
          - Writes it to workspace
          - Runs it, captures stdout/stderr
          - Fixes and reruns on failure

        For conversational tasks:
          - Answers directly via LLM
        """
        task_is_action = is_action(task_input)
        files_created: List[str] = []
        commands_run: List[str] = []
        tool_outputs: List[str] = []
        errors: List[str] = []
        tests: List[str] = []

        # 1. Gather agent's personal persistent memory notes
        agent_memories = ""
        if self.config.memory_enabled:
            agent_memories = memory_store.format_agent_memories_for_prompt(self.config.id)

        # ----------------------------------------------------------------
        # 2a. CALCULATOR: handle pure math expressions
        # ----------------------------------------------------------------
        if "calculator" in self.config.tools:
            math_match = re.search(r"([\d\s\+\-\*\/\%\^\(\)\.]+[\d\)]+)", task_input)
            if math_match and any(op in task_input for op in ["+", "-", "*", "/", "^", "%", "**"]):
                expr = math_match.group(1).strip().replace("^", "**")
                calc_res = tool_registry.execute("calculator", expr)
                tool_outputs.append(f"[Tool: calculator] {expr} = {calc_res}")
                commands_run.append(f"calculator({expr})")

        # ----------------------------------------------------------------
        # 2b. PYTHON_RUNNER & SANDBOX: generate + execute real code for action tasks
        # ----------------------------------------------------------------
        has_exec_tool = any(t in self.config.tools for t in ["python_runner", "sandbox", "workspace_writer"])
        if has_exec_tool and task_is_action:
            # Determine the primary filename from the task (best-effort)
            filename = _infer_filename(task_input)

            # WorkspaceManager for file writing & sandbox execution
            ws = None
            if workspace_id:
                from backend.app.orchestration.workspace import WorkspaceManager
                ws = WorkspaceManager(workspace_id)
                tool_registry.bind_workspace(workspace_id)

            # --- PLANNING: generate code ---
            raw_llm = _generate_code_for_task(task_input, self.config.name, self.config.role)
            code = _extract_code_block(raw_llm)

            if code:
                # --- RUNNING: write + execute ---
                if ws:
                    ws.write_file(filename, code)
                    files_created.append(filename)
                    commands_run.append(f"sandbox.write({filename})")

                # Run via python_runner or workspace subprocess
                if ws:
                    ok_run, run_stdout, run_stderr = ws.run_python(filename)
                    run_result = run_stdout if ok_run else f"Runtime Error: {run_stderr}"
                else:
                    run_result = tool_registry.execute("python_runner", code)

                commands_run.append(f"sandbox.run({filename})")
                tool_outputs.append(f"[Sandbox: {filename}]\n{run_result}")

                # --- TESTING: check for errors ---
                run_failed = (
                    "Runtime Error:" in run_result
                    or "Security Error:" in run_result
                    or "Error:" in run_result[:30]
                )

                if run_failed:
                    errors.append(run_result)
                    tests.append(f"Initial run failed: {run_result[:80]}")

                    # --- FIXING: attempt self-repair ---
                    for attempt in range(1, MAX_FIX_ATTEMPTS + 1):
                        fixed_llm = _generate_code_for_task(
                            task_input,
                            self.config.name,
                            self.config.role,
                            error_context=run_result
                        )
                        fixed_code = _extract_code_block(fixed_llm)
                        if not fixed_code:
                            break

                        if ws:
                            ws.write_file(filename, fixed_code)

                        if ws:
                            ok_fix, fix_out, fix_err = ws.run_python(filename)
                            fix_result = fix_out if ok_fix else f"Runtime Error: {fix_err}"
                        else:
                            fix_result = tool_registry.execute("python_runner", fixed_code)

                        commands_run.append(f"sandbox.run({filename}) [fix {attempt}]")
                        tool_outputs.append(f"[Fix attempt {attempt}]\n{fix_result}")

                        still_failed = (
                            "Runtime Error:" in fix_result
                            or "Security Error:" in fix_result
                        )
                        if not still_failed:
                            tests.append(f"Fixed on attempt {attempt}")
                            errors.clear()
                            code = fixed_code
                            break
                        else:
                            errors.append(f"Fix {attempt} failed: {fix_result}")
                else:
                    tests.append("Code executed successfully")

                # Syntax check on final file
                if ws and files_created:
                    ok, msg = ws.run_syntax_check(filename)
                    if ok:
                        tests.append(f"Syntax check passed: {filename}")
                    else:
                        tests.append(f"Syntax warning: {msg[:80]}")

                # Generic entry-point smoke test — verify the script runs without crashing.
                # We do NOT test implementation-specific class names (e.g. CalculatorEngine)
                # because the LLM may produce functional or procedural designs that are equally valid.
                if ws and files_created and not errors:
                    main_file = files_created[0]
                    if ws.file_exists(main_file):
                        ok_t, out_t, err_t = ws.run_python(main_file)
                        if ok_t:
                            tests.append(f"Entry-point smoke test passed: {main_file}")
                            commands_run.append(f"sandbox.smoke_test({main_file})")
                        elif err_t and "ModuleNotFoundError" not in err_t and "tkinter" not in err_t.lower():
                            # Only record as error if it's a real runtime problem, not a GUI/import issue
                            errors.append(f"Smoke test: {err_t[:120]}")

            else:
                tool_outputs.append(f"[sandbox] Code generation produced no extractable block.")
                tests.append("No runnable code extracted from LLM output")

        # ----------------------------------------------------------------
        # 2c. WORKSPACE_WRITER standalone (non-python tasks)
        # ----------------------------------------------------------------
        elif workspace_id and task_is_action and "workspace_writer" in self.config.tools:
            tool_registry.bind_workspace(workspace_id)

        # ----------------------------------------------------------------
        # 3. Build the final LLM response prompt
        # ----------------------------------------------------------------
        tools_str = ", ".join(self.config.tools) if self.config.tools else "none"
        skills_str = ", ".join(self.config.skills) if self.config.skills else "general problem solving"

        context_parts = []
        if rag_context:
            context_parts.append(f"Retrieved Company Documents (RAG):\n{rag_context}")
        if past_experiences:
            context_parts.append(f"{past_experiences}")
        if agent_memories:
            context_parts.append(f"{agent_memories}")
        if tool_outputs:
            context_parts.append("Tool Execution Results:\n" + "\n".join(tool_outputs))

        full_context = "\n\n".join(context_parts)

        if task_is_action and files_created:
            # Build the clean natural user response directly from execution data.
            # Bypass LLM call entirely for build tasks to prevent boilerplate from SimulatedLLM.
            response_text = _build_summary_from_execution(
                task_input=task_input,
                files_created=files_created,
                commands_run=commands_run,
                tests=tests,
                errors=errors,
                workspace_id=workspace_id,
            )
        else:
            # Conversational or non-code task — use LLM
            prompt = f"""You are {self.config.name}, working as a {self.config.role} in our AI organization.
Description: {self.config.description}
Instructions: {self.config.instructions}
Skills: {skills_str}
Available Tools: {tools_str}

{full_context}

User Task:
{task_input}


Provide a complete, professional, and clear response addressing the user's task directly.
"""

            response_text = llm_generate(prompt)

            # Ensure tool outputs (e.g. calculator results) are preserved
            if tool_outputs:
                for t_out in tool_outputs:
                    if "=" in t_out:
                        val = t_out.split("=")[-1].strip()
                        val_clean = str(int(float(val))) if (val.replace('.', '', 1).isdigit() and float(val).is_integer()) else val
                        if val not in response_text and val_clean not in response_text:
                            response_text += f"\n\n**Result**: {t_out}"

        return {
            "agent_id": self.config.id,
            "agent_name": self.config.name,
            "role": self.config.role,
            "output": response_text.strip(),
            "tools_used": list({
                c.split("(")[0].split(".")[0]
                for c in commands_run
            }),
            "files_created": files_created,
            "commands_run": commands_run,
            "tests": tests,
            "errors": errors,
        }


def _build_summary_from_execution(
    task_input: str,
    files_created: list,
    commands_run: list,
    tests: list,
    errors: list,
    workspace_id: Optional[str],
) -> str:
    """
    Build a clean, natural user-facing summary directly from execution metadata.
    Used for build/action tasks to bypass LLM synthesis (avoiding SimulatedLLM boilerplate).
    """
    t_low = task_input.lower()

    if "calculator" in t_low:
        headline = "Built the calculator."
    elif "fibonacci" in t_low or "fib" in t_low:
        headline = "Generated the fibonacci script."
    elif "password" in t_low:
        headline = "Built the password generator."
    elif "todo" in t_low or "to-do" in t_low:
        headline = "Built the to-do list app."
    elif "snake" in t_low or ("game" in t_low and "calculator" not in t_low):
        headline = "Built the game."
    elif any(v in t_low for v in ["modify", "update", "refactor", "patch"]):
        headline = "Modified the project files."
    elif any(v in t_low for v in ["build", "create", "make", "implement", "write", "generate"]):
        import re as _re
        m = _re.search(r"(?:build|create|make|implement|write|generate)\s+(?:a\s+|an\s+)?([a-z\s0-9_-]{2,30})", t_low)
        noun = m.group(1).strip() if m else "project"
        headline = f"Built the {noun}."
    else:
        headline = "Completed the task."

    parts = [headline, ""]

    parts.append("Created:")
    for f in files_created:
        parts.append(f"\u2022 {f}")

    if tests:
        parts.append("")
        parts.append("Tested:")
        for t in tests:
            t_clean = t.replace("\u2705", "").replace("\u274c", "").replace("\u2022", "").strip()
            if t_clean:
                parts.append(f"\u2022 {t_clean}")

    if errors:
        parts.append("")
        parts.append("Issues:")
        for e in errors[:3]:
            parts.append(f"\u2022 {e[:120]}")

    if workspace_id:
        parts.append("")
        parts.append(f"The project is in the task workspace (`workspaces/{workspace_id}/`).")

    return "\n".join(parts)


def _infer_filename(task_input: str) -> str:
    """
    Infer a sensible Python filename from the task description.
    Examples:
      "Build a GUI calculator"  → "calculator.py"
      "Write a fibonacci sequence" → "fibonacci.py"
      "Create a to-do list app" → "todo_app.py"
    """
    text = task_input.lower()

    # Direct keyword mapping
    keyword_map = {
        "calculator": "calculator.py",
        "fibonacci": "fibonacci.py",
        "todo": "todo_app.py",
        "to-do": "todo_app.py",
        "snake": "snake_game.py",
        "game": "game.py",
        "scraper": "scraper.py",
        "web scrape": "scraper.py",

        "chatbot": "chatbot.py",
        "chat bot": "chatbot.py",
        "api": "api_client.py",
        "csv": "csv_processor.py",
        "sort": "sorter.py",
        "prime": "prime_finder.py",
        "password": "password_generator.py",
        "temperature": "temperature_converter.py",
        "convert": "converter.py",
        "fetch": "fetcher.py",
        "download": "downloader.py",
        "analyze": "analyzer.py",
        "analysis": "analyzer.py",
        "report": "report_generator.py",
        "dashboard": "dashboard.py",
    }
    for kw, fname in keyword_map.items():
        if kw in text:
            return fname

    # Extract first noun phrase after a build verb
    match = re.search(
        r"(?:build|create|write|make|implement|develop|generate)\s+(?:a\s+|an\s+)?([a-z][a-z\s\-]{2,20})",
        text
    )
    if match:
        noun = match.group(1).strip().rstrip("s")
        slug = re.sub(r"[\s\-]+", "_", noun)[:20]
        return f"{slug}.py"

    return "solution.py"
