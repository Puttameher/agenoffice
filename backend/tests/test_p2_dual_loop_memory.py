import pytest
from unittest.mock import patch, AsyncMock
from backend.app.memory.memory_writer import memory_writer
from backend.app.memory.memory_store import memory_store
from backend.app.models.schemas import TaskEvaluation
from backend.app.database.db import init_db

@pytest.fixture(autouse=True)
def setup_db():
    init_db()

@pytest.mark.asyncio
async def test_dual_loop_memory_ignore_short_circuit():
    """
    Casual conversation or greetings should be classified by Jev as IGNORE,
    immediately short-circuiting to destination="skip" without invoking LLM summarizer.
    """
    with patch.object(memory_writer, "_summarize_with_llm") as mock_summarize:
        result = await memory_writer.aprocess(
            task_input="Hello Jordan, how are you doing today?",
            agent_output="I am doing well, ready to help!",
            evaluation=TaskEvaluation(
                id="test_task_ignore",
                task_id="test_task_ignore",
                success=True,
                score=0.95,
                reason="Polite greeting"
            )
        )
        assert result["destination"] == "skip"
        assert result["triage_action"] == "IGNORE"
        # Zero heavy LLM summarization tokens burned!
        mock_summarize.assert_not_called()

@pytest.mark.asyncio
async def test_dual_loop_memory_machine_learning():
    """
    Tactical tasks should be triaged by Jev as MEMORY, triggering LLM summarization
    and persisting distilled lessons into SQLite experiences table.
    """
    result = await memory_writer.aprocess(
        task_input="Solve a subtle floating point calculation bug with Decimal library",
        agent_output="Used decimal.Decimal to eliminate IEEE 754 precision errors.",
        evaluation=TaskEvaluation(
            id="test_task_mem",
            task_id="test_task_mem",
            success=True,
            score=0.90,
            reason="Correct numeric precision"
        )
    )
    assert result["destination"] in ("machine", "both")
    assert result["triage_action"] in ("MEMORY", "SKILL")
    assert "machine_lesson" in result
    assert len(result["machine_lesson"]) > 0

    # Verify stored in SQLite experiences table
    exps = memory_store.get_relevant_experiences("floating point calculation Decimal", limit=1)
    assert len(exps) > 0

@pytest.mark.asyncio
async def test_dual_loop_memory_sync_wrapper():
    """
    Test sync process() method bridges cleanly without event loop conflicts.
    """
    result = memory_writer.process(
        task_input="Casual chitchat greeting",
        agent_output="Hi there!"
    )
    assert "destination" in result
    assert "triage_action" in result
