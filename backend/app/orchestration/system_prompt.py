"""
system_prompt.py — Dynamic system prompt builder for Jordan (the AI Office Manager).

PRD requirement: "main agent fetch from open source / user-defined system prompts."

Jordan's system prompt is built dynamically at request time, injecting:
  - persona & role
  - current workforce (agents list)
  - recent organizational experiences (from memory)
  - active workspace state
  - optional user-defined instructions (from settings or Obsidian vault)

The base persona defaults to a concise, well-crafted open-source prompt.
Users can override it by setting JORDAN_SYSTEM_PROMPT in .env or saving a note
titled "Jordan System Prompt" in their Obsidian vault.
"""

import os
from typing import Optional, List
from backend.app.models.schemas import AgentConfig, ExperienceRecord

# ---------------------------------------------------------------------------
# Base persona — clean, open-source-style system prompt for the manager
# Based on common open-source agent system prompts (e.g., LangChain, AutoGen patterns)
# ---------------------------------------------------------------------------
_BASE_PERSONA = """You are Jordan, an autonomous AI Office Manager and intelligent personal assistant.

Your role:
- You orchestrate a team of specialized AI agents (Alex for coding, Nova for research, Rio for analysis, Mika for content, Zane for design, Taro for operations).
- You can answer questions directly, run single tools (calculator, lookup), or dispatch complex tasks to your specialist team.
- You are concise, direct, and professional — like a senior executive assistant who knows everything happening in the office.
- You never make up facts. If you're uncertain, you say so.
- You always remember past task outcomes and apply lessons from experience.

Personality:
- Efficient and clear — no filler words or unnecessary hedging.
- Warm but not sycophantic — don't start with "Great question!" or "Certainly!".
- Use bullet points for lists, short paragraphs for explanations.
- For technical tasks, lean on your team of specialists.
"""

_ENV_OVERRIDE_KEY = "JORDAN_SYSTEM_PROMPT"


def _load_user_defined_prompt() -> Optional[str]:
    """
    Load a user-defined system prompt from:
    1. JORDAN_SYSTEM_PROMPT environment variable
    2. Obsidian vault note titled 'Jordan System Prompt' (if vault is configured)
    Returns None if no override found.
    """
    # 1. Check env var first
    env_prompt = os.getenv(_ENV_OVERRIDE_KEY, "").strip()
    if env_prompt and len(env_prompt) > 20:
        return env_prompt

    # 2. Check Obsidian vault
    try:
        from backend.app.tools.obsidian_tool import ObsidianTool, _get_vault_path
        import json
        vault = _get_vault_path()
        if vault:
            obs = ObsidianTool()
            result = obs.run(json.dumps({"op": "read_note", "title": "Jordan System Prompt"}))
            if result and "not found" not in result.lower() and "error" not in result.lower():
                return result.strip()
    except Exception:
        pass

    return None


def build_system_prompt(
    agents: Optional[List[AgentConfig]] = None,
    experiences: Optional[List[ExperienceRecord]] = None,
    extra_context: Optional[str] = None,
) -> str:
    """
    Build the complete system prompt for Jordan at request time.

    Args:
        agents: Current workforce list (from Repository.list_agents)
        experiences: Recent relevant experiences from memory
        extra_context: Any additional context (e.g., RAG chunks, Obsidian notes)

    Returns:
        A complete system prompt string ready to prepend to any LLM call.
    """
    # Start with base or user-defined persona
    user_prompt = _load_user_defined_prompt()
    persona = user_prompt if user_prompt else _BASE_PERSONA

    sections = [persona.strip()]

    # Inject workforce info
    if agents:
        workforce_lines = []
        for a in agents:
            skills_str = ", ".join(a.skills[:3]) if a.skills else "General"
            tools_str = ", ".join(a.tools[:2]) if a.tools else "None"
            workforce_lines.append(
                f"  • {a.name} ({a.role}) — Skills: {skills_str} | Tools: {tools_str}"
            )
        sections.append(
            "Your current workforce:\n" + "\n".join(workforce_lines)
        )

    # Inject experience memory (summarized, not raw)
    if experiences:
        exp_lines = []
        for exp in experiences[:3]:
            exp_lines.append(f"  • {exp.task_summary[:80]} → Lesson: {exp.lesson[:100]}")
        sections.append(
            "Relevant past learnings:\n" + "\n".join(exp_lines)
        )

    # Inject extra RAG / Obsidian context
    if extra_context and len(extra_context.strip()) > 10:
        # Summarize if too long
        ctx = extra_context.strip()
        if len(ctx) > 600:
            ctx = ctx[:600] + "...[truncated]"
        sections.append(f"Relevant knowledge:\n{ctx}")

    return "\n\n".join(sections)


def build_chat_prompt(
    user_message: str,
    system_prompt: str,
    conversation_history: Optional[str] = None,
) -> str:
    """
    Build a complete prompt for a direct CHAT response.

    Format:
        [System Prompt]

        [Conversation History (optional)]

        User: {message}
        Jordan:
    """
    parts = [system_prompt]

    if conversation_history and len(conversation_history.strip()) > 5:
        parts.append(f"Recent conversation:\n{conversation_history.strip()}")

    parts.append(f"User: {user_message}\nJordan:")

    return "\n\n".join(parts)
