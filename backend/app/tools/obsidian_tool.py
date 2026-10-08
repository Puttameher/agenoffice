"""
Obsidian Tool — simple file-based vault operations.

Obsidian vaults are just folders of Markdown files.
We don't need a special API. Just read and write .md files.

Supported operations (passed as JSON string):
  {"op": "search_notes",    "query": "LangGraph"}
  {"op": "read_note",       "title": "LangGraph"}
  {"op": "create_note",     "title": "LangGraph", "content": "# LangGraph\n..."}
  {"op": "update_note",     "title": "LangGraph", "content": "# LangGraph\n..."}
  {"op": "append_note",     "title": "LangGraph", "text": "New paragraph here."}
  {"op": "find_related",    "title": "LangGraph"}

Vault path is configured via OBSIDIAN_VAULT_PATH in .env
"""

import os
import json
import re
from pathlib import Path
from datetime import datetime
from typing import Optional

from backend.app.tools.base import BaseTool


def _get_vault_path() -> Optional[Path]:
    """Return configured vault path, or None if not set."""
    raw = os.getenv("OBSIDIAN_VAULT_PATH", "").strip()
    if not raw:
        return None
    p = Path(raw)
    if not p.exists():
        return None
    return p


def _title_to_filename(title: str) -> str:
    """Convert a note title to a safe filename."""
    # Remove characters that are invalid in filenames
    safe = re.sub(r'[<>:"/\\|?*]', "", title)
    safe = safe.strip()
    if not safe:
        safe = "untitled"
    return safe + ".md"


def _find_note_path(vault: Path, title: str) -> Optional[Path]:
    """Find an existing note by title (case-insensitive filename match)."""
    filename = _title_to_filename(title)
    # Exact match first
    candidate = vault / filename
    if candidate.exists():
        return candidate
    # Case-insensitive search across all .md files
    target = filename.lower()
    for f in vault.rglob("*.md"):
        if f.name.lower() == target:
            return f
    return None


def _extract_links(content: str) -> list:
    """Extract all [[wikilinks]] from a markdown document."""
    return re.findall(r"\[\[([^\]]+)\]\]", content)


class ObsidianTool(BaseTool):
    name = "obsidian"
    description = (
        "Read and write notes in the local Obsidian knowledge vault. "
        "Operations: search_notes, read_note, create_note, update_note, append_note, find_related."
    )
    parameters_description = (
        'JSON string with "op" key. '
        'Examples: {"op":"search_notes","query":"LangGraph"} | '
        '{"op":"read_note","title":"LangGraph"} | '
        '{"op":"create_note","title":"LangGraph","content":"# LangGraph\\n..."} | '
        '{"op":"append_note","title":"LangGraph","text":"New info here."} | '
        '{"op":"find_related","title":"LangGraph"}'
    )

    def run(self, argument: str) -> str:
        vault = _get_vault_path()
        if vault is None:
            return (
                "[Obsidian] Vault not configured or not found. "
                "Set OBSIDIAN_VAULT_PATH in your .env file to the full path of your Obsidian vault."
            )

        # Parse the JSON argument
        try:
            args = json.loads(argument.strip())
        except Exception:
            return "[Obsidian] Invalid argument. Must be a JSON string with an 'op' key."

        op = args.get("op", "")

        if op == "search_notes":
            return self._search_notes(vault, args.get("query", ""))

        elif op == "read_note":
            return self._read_note(vault, args.get("title", ""))

        elif op == "create_note":
            return self._create_note(
                vault,
                args.get("title", ""),
                args.get("content", ""),
                overwrite=False
            )

        elif op == "update_note":
            return self._create_note(
                vault,
                args.get("title", ""),
                args.get("content", ""),
                overwrite=True
            )

        elif op == "append_note":
            return self._append_note(vault, args.get("title", ""), args.get("text", ""))

        elif op == "find_related":
            return self._find_related(vault, args.get("title", ""))

        else:
            return f"[Obsidian] Unknown operation '{op}'. Valid ops: search_notes, read_note, create_note, update_note, append_note, find_related."

    # ------------------------------------------------------------------ #
    # Operations                                                           #
    # ------------------------------------------------------------------ #

    def _search_notes(self, vault: Path, query: str) -> str:
        if not query:
            return "[Obsidian] search_notes requires a 'query' value."

        query_lower = query.lower()
        matches = []

        for md_file in vault.rglob("*.md"):
            # Match in filename
            if query_lower in md_file.stem.lower():
                matches.append({"file": md_file.name, "match": "title"})
                continue
            # Match in file content (first 500 chars to stay fast)
            try:
                snippet = md_file.read_text(encoding="utf-8", errors="ignore")[:2000]
                if query_lower in snippet.lower():
                    # Grab the line that contains the match for context
                    for line in snippet.splitlines():
                        if query_lower in line.lower():
                            matches.append({"file": md_file.name, "match": "content", "preview": line[:80].strip()})
                            break
            except Exception:
                pass

            if len(matches) >= 10:
                break

        if not matches:
            return f"[Obsidian] No notes found matching '{query}'."

        lines = [f"[Obsidian] Found {len(matches)} notes matching '{query}':"]
        for m in matches:
            title = Path(m["file"]).stem
            if m["match"] == "content":
                lines.append(f"  - [[{title}]] — {m.get('preview', '')}")
            else:
                lines.append(f"  - [[{title}]] (title match)")
        return "\n".join(lines)

    def _read_note(self, vault: Path, title: str) -> str:
        if not title:
            return "[Obsidian] read_note requires a 'title' value."

        path = _find_note_path(vault, title)
        if path is None:
            return f"[Obsidian] Note '[[{title}]]' not found in vault."

        content = path.read_text(encoding="utf-8", errors="ignore")
        if len(content) > 3000:
            content = content[:3000] + "\n\n...(truncated)"
        return f"[Obsidian] Note: [[{title}]]\n\n{content}"

    def _create_note(self, vault: Path, title: str, content: str, overwrite: bool = False) -> str:
        if not title:
            return "[Obsidian] create_note requires a 'title' value."
        if not content:
            return "[Obsidian] create_note requires 'content' value."

        filename = _title_to_filename(title)
        path = vault / filename

        if path.exists() and not overwrite:
            return (
                f"[Obsidian] Note '[[{title}]]' already exists. "
                "Use op='update_note' to overwrite, or op='append_note' to add content."
            )

        # Add a timestamp footer if creating fresh
        final_content = content
        if not overwrite:
            ts = datetime.now().strftime("%Y-%m-%d %H:%M")
            final_content += f"\n\n---\n*Created by Agentic AI Office — {ts}*"

        path.write_text(final_content, encoding="utf-8")
        action = "Updated" if (path.exists() and overwrite) else "Created"
        return f"[Obsidian] {action} note '[[{title}]]' → {filename}"

    def _append_note(self, vault: Path, title: str, text: str) -> str:
        if not title:
            return "[Obsidian] append_note requires a 'title' value."
        if not text:
            return "[Obsidian] append_note requires 'text' value."

        path = _find_note_path(vault, title)
        if path is None:
            # If note doesn't exist, create it
            return self._create_note(vault, title, text, overwrite=False)

        existing = path.read_text(encoding="utf-8", errors="ignore")
        ts = datetime.now().strftime("%Y-%m-%d %H:%M")
        appended = existing.rstrip() + f"\n\n## Update — {ts}\n\n{text}\n"
        path.write_text(appended, encoding="utf-8")
        return f"[Obsidian] Appended to '[[{title}]]'."

    def _find_related(self, vault: Path, title: str) -> str:
        """Find notes that link to this note, or share links with it."""
        if not title:
            return "[Obsidian] find_related requires a 'title' value."

        # First, get links inside the target note itself
        path = _find_note_path(vault, title)
        own_links = []
        if path:
            content = path.read_text(encoding="utf-8", errors="ignore")
            own_links = _extract_links(content)

        # Then, find other notes that link to this one
        backlinks = []
        title_lower = title.lower()
        for md_file in vault.rglob("*.md"):
            if md_file.name.lower() == _title_to_filename(title).lower():
                continue
            try:
                text = md_file.read_text(encoding="utf-8", errors="ignore")
                links = _extract_links(text)
                for link in links:
                    if link.lower() == title_lower:
                        backlinks.append(md_file.stem)
                        break
            except Exception:
                pass

        lines = [f"[Obsidian] Related notes for '[[{title}]]':"]
        if own_links:
            lines.append(f"  Links from this note: {', '.join([f'[[{l}]]' for l in own_links[:8]])}")
        if backlinks:
            lines.append(f"  Backlinks (notes that reference this): {', '.join([f'[[{b}]]' for b in backlinks[:8]])}")
        if not own_links and not backlinks:
            lines.append("  No related notes found.")

        return "\n".join(lines)
