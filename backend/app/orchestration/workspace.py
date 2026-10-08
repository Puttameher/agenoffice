"""
workspace.py — Per-task isolated workspace manager.

Each task gets its own directory under workspaces/task_<id>/ so that
generated files (scripts, HTML, outputs) are scoped and inspectable.
"""

import os
import subprocess
import shutil
import sys
from pathlib import Path
from typing import List, Optional, Tuple

# Root for all per-task workspaces, sibling to the backend/ directory
_WORKSPACE_ROOT: Optional[Path] = None


def _get_workspace_root() -> Path:
    global _WORKSPACE_ROOT
    if _WORKSPACE_ROOT is None:
        # Resolve relative to this file: backend/app/orchestration/ -> project root
        here = Path(__file__).resolve()
        project_root = here.parents[3]  # goes up: orchestration -> app -> backend -> project
        _WORKSPACE_ROOT = project_root / "workspaces"
        _WORKSPACE_ROOT.mkdir(parents=True, exist_ok=True)
    return _WORKSPACE_ROOT


class WorkspaceManager:
    """
    Manages an isolated directory for a specific task execution.

    Usage:
        ws = WorkspaceManager(task_id)
        ws.write_file("script.py", "print('hello')")
        output = ws.read_file("script.py")
        files = ws.list_files()
        ok, stdout, stderr = ws.run_python("script.py")
    """

    def __init__(self, task_id: str):
        self.task_id = task_id
        self.root = _get_workspace_root() / task_id
        self.root.mkdir(parents=True, exist_ok=True)

    def path(self, filename: str = "") -> Path:
        """Return the absolute path for a file in this workspace.
        Supports subdirectories (e.g. 'src/main.py').
        """
        if filename:
            # Resolve and validate that the result is inside the workspace root
            target = (self.root / filename).resolve()
            try:
                target.relative_to(self.root.resolve())
            except ValueError:
                raise PermissionError(f"Path traversal attempt blocked: {filename}")
            return target
        return self.root

    def write_file(self, filename: str, content: str) -> Path:
        """Write content to a file in the workspace.
        Creates any needed subdirectories automatically.
        Returns the absolute file path.
        """
        target = self.path(filename)
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(content, encoding="utf-8")
        return target

    def read_file(self, filename: str) -> str:
        """Read and return the content of a file in the workspace."""
        target = self.path(filename)
        if not target.exists():
            raise FileNotFoundError(f"Workspace file not found: {filename}")
        return target.read_text(encoding="utf-8")

    def list_files(self) -> List[str]:
        """List all files in this workspace (including subdirectories), relative paths."""
        result = []
        for f in self.root.rglob("*"):
            if f.is_file():
                result.append(str(f.relative_to(self.root)))
        return result

    def file_exists(self, filename: str) -> bool:
        """Check if a file exists in the workspace."""
        return self.path(filename).exists()

    def run_python(self, filename: str, timeout: int = 10) -> Tuple[bool, str, str]:
        """
        Execute a Python file in the workspace as a subprocess.
        Returns (success, stdout, stderr).
        Uses the current interpreter so the same venv is active.
        """
        target = self.path(filename)
        if not target.exists():
            return False, "", f"File not found: {filename}"
        try:
            result = subprocess.run(
                [sys.executable, str(target)],
                capture_output=True,
                text=True,
                timeout=timeout,
                cwd=str(self.root)
            )
            success = result.returncode == 0
            return success, result.stdout, result.stderr
        except subprocess.TimeoutExpired:
            return False, "", f"Execution timed out after {timeout}s"
        except Exception as e:
            return False, "", str(e)

    def run_syntax_check(self, filename: str) -> Tuple[bool, str]:
        """
        Run py_compile syntax check on a Python file.
        Returns (ok, error_message).
        """
        import py_compile
        target = self.path(filename)
        if not target.exists():
            return False, f"File not found: {filename}"
        try:
            py_compile.compile(str(target), doraise=True)
            return True, ""
        except py_compile.PyCompileError as e:
            return False, str(e)

    @staticmethod
    def find_existing_workspace(query: str) -> Optional[str]:
        """
        Inspect the workspaces directory to see if an existing project or file
        matches the user's modification request.
        Returns the existing task_id workspace, or None.
        """
        import re
        root = _get_workspace_root()
        if not root.exists():
            return None

        # Check if any filename mentioned in the query exists in an existing workspace
        words = re.findall(r"[\w\.\-]+\.[\w]+", query)
        for task_dir in sorted(root.iterdir(), key=lambda p: p.stat().st_mtime, reverse=True):
            if task_dir.is_dir():
                for target_file in words:
                    if (task_dir / target_file).exists():
                        return task_dir.name
        return None

    def modify_file(self, filename: str, content: str) -> Path:
        """Modify or overwrite an existing file in the workspace."""
        return self.write_file(filename, content)

    def append_file(self, filename: str, content: str) -> Path:
        """Append content to a file in the workspace."""
        target = self.path(filename)
        target.parent.mkdir(parents=True, exist_ok=True)
        with target.open("a", encoding="utf-8") as f:
            f.write(content)
        return target

    def run_command(self, cmd: str, timeout: int = 15) -> Tuple[bool, str, str, int]:
        """
        Run an arbitrary command in the isolated workspace directory.
        Returns (success, stdout, stderr, returncode).
        """
        try:
            res = subprocess.run(
                cmd,
                shell=True,
                capture_output=True,
                text=True,
                timeout=timeout,
                cwd=str(self.root)
            )
            return res.returncode == 0, res.stdout, res.stderr, res.returncode
        except subprocess.TimeoutExpired:
            return False, "", f"Command timed out after {timeout}s", -1
        except Exception as e:
            return False, "", str(e), -1

    def run_tests(self, test_code_or_filename: str, timeout: int = 15) -> Tuple[bool, str, str]:
        """
        Execute unit tests in the workspace.
        Can be a filename (e.g. 'test_calc.py') or inline Python code.
        """
        if test_code_or_filename.endswith(".py") and self.file_exists(test_code_or_filename):
            ok, stdout, stderr = self.run_python(test_code_or_filename, timeout=timeout)
            return ok, stdout, stderr
        else:
            try:
                res = subprocess.run(
                    [sys.executable, "-c", test_code_or_filename],
                    capture_output=True,
                    text=True,
                    timeout=timeout,
                    cwd=str(self.root)
                )
                return res.returncode == 0, res.stdout, res.stderr
            except Exception as e:
                return False, "", str(e)

    def cleanup(self):
        """Remove the entire workspace directory (call after task archival)."""
        if self.root.exists():
            shutil.rmtree(self.root, ignore_errors=True)

    def workspace_summary(self) -> str:
        """Return a human-readable summary of workspace contents."""
        files = self.list_files()
        if not files:
            return f"Workspace [{self.task_id}]: empty"
        lines = [f"Workspace [{self.task_id}] — {len(files)} file(s):"]
        for f in files:
            size = (self.root / f).stat().st_size
            lines.append(f"  • {f} ({size} bytes)")
        return "\n".join(lines)

    @property
    def abs_path(self) -> str:
        """Absolute path to the workspace root directory as a string."""
        return str(self.root)
