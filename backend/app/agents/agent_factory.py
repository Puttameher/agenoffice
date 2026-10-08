import json
import uuid
import re
from typing import Optional, Dict, Any, List
from backend.app.models.schemas import AgentConfig, AgentStatus
from backend.app.database.repository import Repository
from backend.app.llm import llm_generate

class AgentFactory:
    """
    Factory for creating validated permanent and temporary agents.
    Uses LLM structured extraction from natural language prompts.
    """
    
    @staticmethod
    def _find_available_desk() -> int:
        """Finds an unused desk number between 1 and 6, or cycles cleanly when all are occupied."""
        existing_agents = Repository.list_agents(include_archived=False)
        occupied_desks = {a.desk_id for a in existing_agents}
        for desk in range(1, 7):
            if desk not in occupied_desks:
                return desk
        # When all desks have an agent registered, cycle cleanly among workstations (1 to 6)
        return (len(existing_agents) % 6) + 1

    @classmethod
    def create_agent_from_prompt(cls, prompt: str, permanent: bool = True,
                                  name_override: Optional[str] = None,
                                  description_override: Optional[str] = None,
                                  tools_override: Optional[List[str]] = None,
                                  model_override: Optional[str] = None,
                                  memory_enabled: bool = True) -> AgentConfig:
        """
        Converts natural-language prompt into a validated AgentConfig.
        Accepts optional override fields from the hire drawer form that take precedence
        over LLM-extracted values.
        """
        extraction_prompt = f"""
Extract agent configuration from the following user prompt.
Return ONLY a valid JSON object with these exact keys:
- name: string
- role: string
- description: string
- instructions: string
- skills: array of strings
- tools: array of strings (allowed: ["calculator", "python_runner", "browser", "file_reader", "obsidian", "form_filler"])
- permanent: boolean ({str(permanent).lower()})
- memory_enabled: boolean (true)

User Request:
"{prompt}"
"""
        response_text = llm_generate(extraction_prompt)
        
        # Parse JSON
        try:
            # Extract JSON block if wrapped in markdown
            json_match = re.search(r"\{[\s\S]*\}", response_text)
            if json_match:
                config_dict = json.loads(json_match.group(0))
            else:
                config_dict = json.loads(response_text)
        except Exception:
            # Safe programmatic fallback if parsing fails
            config_dict = {
                "name": "Alex",
                "role": "Python Specialist",
                "description": "Specialized agent for Python development and debugging.",
                "instructions": "Write clean, tested Python code and analyze bugs carefully.",
                "skills": ["Python", "debugging", "problem solving"],
                "tools": ["python_runner", "calculator"],
                "permanent": permanent,
                "memory_enabled": True
            }

        # Validate tools against allowed tools
        valid_tools = ["calculator", "python_runner", "browser", "file_reader", "obsidian", "form_filler"]

        # Form overrides take precedence over LLM-extracted values
        if tools_override is not None:
            filtered_tools = [t for t in tools_override if t in valid_tools]
        else:
            raw_tools = config_dict.get("tools", [])
            filtered_tools = [t for t in raw_tools if t in valid_tools]
            if not filtered_tools and ("python" in prompt.lower() or "code" in prompt.lower()):
                filtered_tools = ["python_runner", "calculator"]
            elif not filtered_tools:
                filtered_tools = ["calculator"]

        # Apply name / description overrides
        final_name = name_override or config_dict.get("name", "Specialist")
        final_desc = description_override or config_dict.get("description", "AI agent assistant.")
        final_instr = description_override or config_dict.get("instructions", "Assist with task execution thoroughly.")

        agent = AgentConfig(
            id=f"agent_{uuid.uuid4().hex[:8]}",
            name=final_name,
            role=config_dict.get("role", "General Agent"),
            description=final_desc,
            instructions=final_instr,
            model=model_override or None,
            skills=config_dict.get("skills", ["general"]),
            tools=filtered_tools,
            permanent=permanent,
            memory_enabled=memory_enabled,
            status="idle",
            desk_id=cls._find_available_desk()
        )
        
        return Repository.save_agent(agent)

    @classmethod
    def create_temporary_agent(cls, task_description: str, missing_capability: str) -> AgentConfig:
        """
        Dynamically spawns a temporary specialist agent for an uncovered domain capability.
        """
        prompt = f"Create a temporary specialist for '{missing_capability}' to solve: {task_description}"
        temp_agent = cls.create_agent_from_prompt(prompt, permanent=False)
        temp_agent.name = f"Temp_{temp_agent.name}"
        Repository.save_agent(temp_agent)
        return temp_agent

    @classmethod
    def archive_agent(cls, agent_id: str):
        """Archives an agent when temporary execution finishes or when deleted."""
        Repository.update_agent_status(agent_id, "archived")

agent_factory = AgentFactory()
