import pytest
from backend.app.models.schemas import AgentConfig
from backend.app.agents.generic_agent import GenericAgent
from backend.app.agents.agent_factory import agent_factory
from backend.app.database.repository import Repository
from backend.app.database.db import init_db

@pytest.fixture(autouse=True)
def setup_db():
    init_db()

def test_generic_agent_tool_execution():
    agent_config = AgentConfig(
        id="test_agent_math",
        name="MathBot",
        role="Calculator Specialist",
        description="Handles arithmetic operations.",
        instructions="Perform arithmetic accurately.",
        skills=["math", "calculation"],
        tools=["calculator"],
        permanent=True,
        memory_enabled=True,
        status="idle",
        desk_id=1
    )
    agent = GenericAgent(agent_config)
    result = agent.execute("Calculate 25 * 4 + 50")
    
    assert result["agent_name"] == "MathBot"
    assert "calculator" in result["tools_used"]
    assert "150" in result["output"]

def test_agent_factory_nl_prompt_creation():
    prompt = "Create Alex as a Python coding agent specializing in debugging."
    agent = agent_factory.create_agent_from_prompt(prompt, permanent=True)
    
    assert agent.name == "Alex"
    assert agent.permanent is True
    assert 1 <= agent.desk_id <= 6
    assert "calculator" in agent.tools or "python_runner" in agent.tools
    
    # Verify saved in SQLite
    retrieved = Repository.get_agent(agent.id)
    assert retrieved is not None
    assert retrieved.name == "Alex"

def test_temporary_agent_lifecycle():
    task = "Analyze quarterly tax deductions for crypto assets."
    temp_agent = agent_factory.create_temporary_agent(task, "Cryptocurrency Tax Accounting")
    
    assert temp_agent.permanent is False
    assert temp_agent.name.startswith("Temp_")
    assert temp_agent.status == "idle"
    
    # Archive temporary agent
    agent_factory.archive_agent(temp_agent.id)
    retrieved = Repository.get_agent(temp_agent.id)
    assert retrieved.status == "archived"
