import io
import sys
import math
import ast
import operator
from typing import Dict, Any, Callable, List, Optional
from pydantic import BaseModel
from backend.app.tools.base import BaseTool

class ToolDefinition(BaseModel):
    name: str
    description: str
    parameters_description: str

# Safe calculator using AST evaluation
class CalculatorTool(BaseTool):
    name = "calculator"
    description = "Evaluates standard arithmetic and mathematical expressions. Example: '100 * (1 + 0.05) ** 3'"
    parameters_description = "Mathematical expression as a string"

    # Supported operators
    _operators = {
        ast.Add: operator.add,
        ast.Sub: operator.sub,
        ast.Mult: operator.mul,
        ast.Div: operator.truediv,
        ast.Pow: operator.pow,
        ast.Mod: operator.mod,
        ast.USub: operator.neg,
        ast.UAdd: operator.pos,
    }

    def _eval(self, node):
        if isinstance(node, ast.Constant):
            if isinstance(node.value, (int, float)):
                return node.value
            raise ValueError("Only numeric constants allowed")
        elif isinstance(node, ast.BinOp):
            op_type = type(node.op)
            if op_type in self._operators:
                return self._operators[op_type](self._eval(node.left), self._eval(node.right))
            raise ValueError(f"Unsupported operator: {op_type}")
        elif isinstance(node, ast.UnaryOp):
            op_type = type(node.op)
            if op_type in self._operators:
                return self._operators[op_type](self._eval(node.operand))
            raise ValueError(f"Unsupported unary operator: {op_type}")
        elif isinstance(node, ast.Call):
            # Allow select math functions: sqrt, abs, round, sin, cos, ceil, floor
            func_name = getattr(node.func, 'id', None)
            allowed_math = {
                'sqrt': math.sqrt, 'abs': abs, 'round': round,
                'ceil': math.ceil, 'floor': math.floor, 'log': math.log
            }
            if func_name in allowed_math:
                args = [self._eval(arg) for arg in node.args]
                return allowed_math[func_name](*args)
            raise ValueError(f"Function '{func_name}' not permitted")
        else:
            raise ValueError(f"Unsupported expression element: {type(node).__name__}")

    def run(self, argument: str) -> str:
        try:
            expr = argument.strip()
            tree = ast.parse(expr, mode='eval')
            result = self._eval(tree.body)
            return str(result)
        except Exception as e:
            return f"Calculator Error: {str(e)}"

# Safe controlled Python code runner
class PythonRunnerTool(BaseTool):
    name = "python_runner"
    description = "Executes simple algorithmic Python scripts in a safe sandbox. Useful for data processing, loops, and logic."
    parameters_description = "Valid Python code to execute. Prints output to stdout."

    def run(self, argument: str) -> str:
        code = argument.strip()
        # Clean markdown code blocks if wrapped
        if code.startswith("```python"):
            code = code[len("```python"):].strip()
        if code.startswith("```"):
            code = code[len("```"):].strip()
        if code.endswith("```"):
            code = code[:-len("```")].strip()

        # Reject disallowed security risks
        disallowed = ["import os", "import sys", "import subprocess", "import socket", "open(", "eval(", "exec(", "__"]
        for bad in disallowed:
            if bad in code:
                return f"Security Error: Usage of '{bad}' is strictly forbidden in the safe runner."

        old_stdout = sys.stdout
        redirected_output = io.StringIO()
        sys.stdout = redirected_output
        
        safe_globals = {
            "__builtins__": {
                "range": range, "len": len, "print": print, "int": int, "float": float,
                "str": str, "bool": bool, "list": list, "dict": dict, "set": set,
                "tuple": tuple, "min": min, "max": max, "sum": sum, "abs": abs,
                "round": round, "sorted": sorted, "enumerate": enumerate, "zip": zip
            },
            "math": math
        }
        
        try:
            exec(code, safe_globals, {})
            output = redirected_output.getvalue()
            return output if output.strip() else "Execution completed successfully (no stdout output)."
        except Exception as e:
            return f"Runtime Error: {str(e)}"
        finally:
            sys.stdout = old_stdout

# Browser tool for web document and URL content extraction
class BrowserTool(BaseTool):
    name = "browser"
    description = "Safe web document inspection and URL content fetching. Extracts titles, text content, and links from public web pages."
    parameters_description = "URL string to inspect (e.g. 'https://example.com' or 'http://localhost:8000')"

    def run(self, argument: str) -> str:
        import urllib.request
        import urllib.parse
        import re
        
        url = argument.strip()
        if not url:
            return "Browser Error: Please specify a URL to inspect."
        
        if not url.startswith("http://") and not url.startswith("https://"):
            url = "https://" + url

        try:
            req = urllib.request.Request(
                url,
                headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AgenticOffice/1.0"}
            )
            with urllib.request.urlopen(req, timeout=5) as response:
                html_bytes = response.read(65536)  # Read at most 64KB
                encoding = response.headers.get_content_charset() or "utf-8"
                html = html_bytes.decode(encoding, errors="replace")

            # Extract title
            title_match = re.search(r"<title[^>]*>(.*?)</title>", html, re.IGNORECASE | re.DOTALL)
            title = title_match.group(1).strip() if title_match else "No title found"

            # Remove scripts, styles, and html tags
            cleaned = re.sub(r"<(script|style)[^>]*>.*?</\1>", "", html, flags=re.IGNORECASE | re.DOTALL)
            cleaned = re.sub(r"<[^>]+>", " ", cleaned)
            cleaned = re.sub(r"\s+", " ", cleaned).strip()

            preview = cleaned[:1200] + ("..." if len(cleaned) > 1200 else "")
            return f"[Browser Result]\nURL: {url}\nPage Title: {title}\nContent Preview:\n{preview}"
        except Exception as e:
            return f"Browser Notice: Could not access '{url}' ({str(e)}). Ensure the target is reachable or running locally."

# Form Filler tool for structured data input and automation
class FormFillerTool(BaseTool):
    name = "form_filler"
    description = "Fills out, validates, and formats structured form schemas, web inputs, and automated submission payloads."
    parameters_description = "Key-value pairs or JSON specifying form fields (e.g. 'name: Elena, email: elena@office.ai, department: Data Science')"

    def run(self, argument: str) -> str:
        import json
        import re
        from datetime import datetime, timezone

        raw = argument.strip()
        if not raw:
            return "Form Filler Error: No form fields provided."

        fields = {}
        # Try JSON first
        try:
            fields = json.loads(raw)
        except Exception:
            # Parse key-value lines
            lines = re.split(r"[,;\n]", raw)
            for line in lines:
                if ":" in line:
                    k, v = line.split(":", 1)
                    fields[k.strip()] = v.strip()
                elif "=" in line:
                    k, v = line.split("=", 1)
                    fields[k.strip()] = v.strip()

        if not fields:
            return f"Form Filler Error: Unable to extract fields from input: '{raw}'"

        # Validate standard fields
        validation_notes = []
        for k, v in fields.items():
            if "email" in k.lower():
                if "@" not in str(v) or "." not in str(v):
                    validation_notes.append(f"⚠️ Field '{k}' may be invalid email format ({v}).")
            if not str(v).strip():
                validation_notes.append(f"⚠️ Field '{k}' is empty.")

        status = "PASSED (Ready for submission)" if not validation_notes else "VALIDATED WITH WARNINGS"
        output_payload = {
            "submission_id": f"form_{int(datetime.now(timezone.utc).timestamp())}",
            "fields": fields,
            "status": status,
            "warnings": validation_notes,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        return f"[Form Filler Automation]\nStatus: {status}\nPayload:\n{json.dumps(output_payload, indent=2)}"

# Laptop File Reader for local workspace inspection
class LaptopFileReaderTool(BaseTool):
    name = "laptop_file_reader"
    description = "Safe read-only access to files and directory structure in the local laptop project repository."
    parameters_description = "Relative path to file or directory (e.g. 'README.md', 'backend/requirements.txt', or 'list:backend/app')"

    def __init__(self):
        import os
        self.workspace_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))

    def run(self, argument: str) -> str:
        import os
        target = argument.strip()
        if not target:
            return "Laptop File Reader Error: Please provide a file path or 'list:<dir>'."

        is_list = False
        if target.startswith("list:"):
            is_list = True
            target = target[len("list:"):].strip()

        # Sanitize path to remain inside workspace root
        target_path = os.path.abspath(os.path.join(self.workspace_root, target))
        try:
            common = os.path.commonpath([self.workspace_root, target_path])
            if common != self.workspace_root:
                return "Security Error: Access outside the workspace directory is restricted."
        except Exception:
            return "Security Error: Invalid path."

        if not os.path.exists(target_path):
            return f"Laptop File Reader: Target path '{target}' not found in workspace."

        if is_list or os.path.isdir(target_path):
            try:
                entries = os.listdir(target_path)
                entries_str = "\n".join([f"- {'[DIR] ' if os.path.isdir(os.path.join(target_path, e)) else '[FILE] '} {e}" for e in entries[:40]])
                return f"[Directory Listing: {target}]\nTotal items: {len(entries)}\n{entries_str}"
            except Exception as e:
                return f"Directory read error: {str(e)}"

        try:
            with open(target_path, "r", encoding="utf-8", errors="replace") as f:
                lines = [next(f) for _ in range(120)]
            content = "".join(lines)
            return f"[Laptop File: {target} (first {len(lines)} lines)]\n{content}"
        except Exception as e:
            return f"File read error: {str(e)}"

class WorkspaceWriterTool(BaseTool):
    """
    Writes, reads, and lists files in the current task workspace.

    Operations (passed as JSON string):
        {"op": "write", "filename": "calc.py", "content": "..."}
        {"op": "read",  "filename": "calc.py"}
        {"op": "list"}

    The workspace_id must be set via set_workspace() before use.
    """
    name = "workspace_writer"
    description = "Writes files to, reads files from, and lists files in the current task workspace."
    parameters_description = (
        'JSON string with op ("write"|"read"|"list"), '
        'filename (str), and content (str for write). '
        'Example: {"op":"write","filename":"hello.py","content":"print(42)"}'
    )

    def __init__(self):
        self._workspace_id: Optional[str] = None

    def set_workspace(self, workspace_id: str):
        """Bind this tool instance to a specific task workspace."""
        self._workspace_id = workspace_id

    def run(self, argument: str) -> str:
        import json as _json
        if not self._workspace_id:
            return "WorkspaceWriter Error: No workspace set. Call set_workspace(task_id) first."

        from backend.app.orchestration.workspace import WorkspaceManager
        ws = WorkspaceManager(self._workspace_id)

        try:
            params = _json.loads(argument.strip())
        except Exception:
            return "WorkspaceWriter Error: argument must be valid JSON."

        op = params.get("op", "").lower()

        if op == "write":
            filename = params.get("filename", "").strip()
            content = params.get("content", "")
            if not filename:
                return "WorkspaceWriter Error: 'filename' is required for write."
            try:
                path = ws.write_file(filename, content)
                return f"[WorkspaceWriter] Written: {filename} ({len(content)} chars) → {path}"
            except Exception as e:
                return f"WorkspaceWriter Write Error: {e}"

        elif op == "read":
            filename = params.get("filename", "").strip()
            if not filename:
                return "WorkspaceWriter Error: 'filename' is required for read."
            try:
                content = ws.read_file(filename)
                return f"[WorkspaceWriter] {filename}:\n{content}"
            except FileNotFoundError:
                return f"WorkspaceWriter Error: '{filename}' not found in workspace."
            except Exception as e:
                return f"WorkspaceWriter Read Error: {e}"

        elif op == "list":
            files = ws.list_files()
            if not files:
                return f"[WorkspaceWriter] Workspace {self._workspace_id}: empty"
            return f"[WorkspaceWriter] Workspace {self._workspace_id} — {len(files)} file(s):\n" + "\n".join(f"  • {f}" for f in files)

        else:
            return f"WorkspaceWriter Error: Unknown op '{op}'. Use 'write', 'read', or 'list'."


class SandboxTool(BaseTool):
    """
    Modern isolated workspace sandbox execution tool.
    Enables agents to create files, modify files, run commands, execute code,
    inspect stdout/stderr/exit codes, and run automated tests.
    """
    name = "sandbox"
    description = (
        "Isolated development sandbox. Perform real file operations, run shell commands, "
        "execute Python scripts, and verify test assertions."
    )
    parameters_description = (
        'JSON string: {"op": "write"|"read"|"modify"|"list"|"run_python"|"run_command"|"run_tests", '
        '"filename": str, "content": str, "cmd": str, "test_code": str}'
    )

    def __init__(self):
        self._workspace_id: Optional[str] = None

    def set_workspace(self, workspace_id: str):
        self._workspace_id = workspace_id

    def run(self, argument: str) -> str:
        import json as _json
        if not self._workspace_id:
            return "Sandbox Error: Workspace not initialized. Call set_workspace() first."

        from backend.app.orchestration.workspace import WorkspaceManager
        ws = WorkspaceManager(self._workspace_id)

        try:
            params = _json.loads(argument.strip()) if argument.strip().startswith("{") else {"op": "run_command", "cmd": argument.strip()}
        except Exception:
            params = {"op": "run_command", "cmd": argument.strip()}

        op = params.get("op", "run_command").lower()

        if op in ("write", "create_file", "modify", "modify_file"):
            filename = params.get("filename", "").strip()
            content = params.get("content", "")
            if not filename:
                return "Sandbox Error: 'filename' is required."
            path = ws.write_file(filename, content)
            return f"[Sandbox] Written: {filename} ({len(content)} chars) at {path}"

        elif op in ("read", "read_file"):
            filename = params.get("filename", "").strip()
            if not filename:
                return "Sandbox Error: 'filename' is required."
            try:
                return ws.read_file(filename)
            except Exception as e:
                return f"Sandbox Read Error: {e}"

        elif op in ("list", "list_files"):
            files = ws.list_files()
            if not files:
                return f"[Sandbox] Workspace {self._workspace_id} is empty."
            return f"[Sandbox] Workspace files ({len(files)}):\n" + "\n".join(f"  • {f}" for f in files)

        elif op in ("run_python", "execute"):
            filename = params.get("filename", "").strip()
            if not filename:
                return "Sandbox Error: 'filename' is required."
            ok, stdout, stderr = ws.run_python(filename)
            status_tag = "SUCCESS" if ok else "FAILED"
            return f"[Sandbox: Python {filename}] Status: {status_tag}\nStdout:\n{stdout}\nStderr:\n{stderr}"

        elif op in ("run_command", "cmd", "terminal"):
            cmd = params.get("cmd", "").strip()
            if not cmd:
                return "Sandbox Error: 'cmd' is required."
            ok, stdout, stderr, code = ws.run_command(cmd)
            status_tag = "SUCCESS" if ok else f"FAILED (exit code {code})"
            return f"[Sandbox: Command] Status: {status_tag}\nStdout:\n{stdout}\nStderr:\n{stderr}"

        elif op in ("run_tests", "test"):
            target = params.get("filename", "") or params.get("test_code", "")
            if not target:
                return "Sandbox Error: 'filename' or 'test_code' is required for testing."
            ok, stdout, stderr = ws.run_tests(target)
            status_tag = "PASSED" if ok else "FAILED"
            return f"[Sandbox: Tests] Result: {status_tag}\nStdout:\n{stdout}\nStderr:\n{stderr}"

        else:
            return f"Sandbox Error: Unknown operation '{op}'."


class ToolRegistry:
    def __init__(self):
        self._tools: Dict[str, BaseTool] = {}
        self.register(CalculatorTool())
        self.register(PythonRunnerTool())
        self.register(BrowserTool())
        self.register(FormFillerTool())
        self.register(LaptopFileReaderTool())
        self.register(WorkspaceWriterTool())
        self.register(SandboxTool())
        # Obsidian registered lazily to avoid circular imports at module load time
        from backend.app.tools.obsidian_tool import ObsidianTool
        self.register(ObsidianTool())

    def register(self, tool: BaseTool):
        self._tools[tool.name] = tool

    def get(self, name: str) -> Optional[BaseTool]:
        return self._tools.get(name)

    def list_tools(self) -> List[ToolDefinition]:
        return [
            ToolDefinition(
                name=t.name,
                description=t.description,
                parameters_description=t.parameters_description
            )
            for t in self._tools.values()
        ]

    def execute(self, name: str, argument: str) -> str:
        tool = self.get(name)
        if not tool:
            return f"Error: Tool '{name}' not found."
        return tool.run(argument)

    def bind_workspace(self, workspace_id: str):
        """Bind workspace-scoped tools to a specific task workspace."""
        for tool_name in ["workspace_writer", "sandbox"]:
            tool = self._tools.get(tool_name)
            if tool and hasattr(tool, "set_workspace"):
                tool.set_workspace(workspace_id)

tool_registry = ToolRegistry()

