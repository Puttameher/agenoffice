import pytest
from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.database.db import init_db

from backend.app.llm import llm_config

@pytest.fixture(autouse=True)
def setup_app_db(monkeypatch):
    init_db()
    monkeypatch.setattr(llm_config, "api_key", None)

client = TestClient(app)

def test_get_organization_state():
    response = client.get("/api/organization/state")
    assert response.status_code == 200
    data = response.json()
    assert "manager" in data
    assert "agents" in data
    assert "active_tasks" in data
    assert "total_completed_tasks" in data
    assert data["manager"]["name"] == "Jordan"

def test_create_agent_via_prompt():
    payload = {"prompt": "Create DevBob, a Python data specialist who writes scripts."}
    response = client.post("/api/agents", json=payload)
    assert response.status_code == 200
    agent = response.json()
    assert agent["name"] in ["DevBob", "Bob", "Specialist"]
    assert agent["permanent"] is True
    assert "id" in agent

def test_create_and_get_task():
    payload = {"user_input": "Calculate 200 * 5"}
    response = client.post("/api/tasks", json=payload)
    assert response.status_code == 200
    task = response.json()
    assert task["id"].startswith("task_")
    
    # Retrieve task
    get_res = client.get(f"/api/tasks/{task['id']}")
    assert get_res.status_code == 200
    assert get_res.json()["user_input"] == "Calculate 200 * 5"

def test_submit_feedback():
    # First create task
    task_res = client.post("/api/tasks", json={"user_input": "Test task"}).json()
    
    # Submit feedback
    fb_payload = {
        "task_id": task_res["id"],
        "rating": 5,
        "comment": "Outstanding speed and accuracy!"
    }
    fb_res = client.post("/api/feedback", json=fb_payload)
    assert fb_res.status_code == 200
    fb_data = fb_res.json()
    assert fb_data["rating"] == 5
    assert fb_data["comment"] == "Outstanding speed and accuracy!"

def test_context_current_and_summarize():
    # 1. Check get current context
    cur_res = client.get("/api/context/current")
    assert cur_res.status_code == 200
    cur_data = cur_res.json()
    assert cur_data["status"] == "ready"
    assert "recent_tasks" in cur_data
    assert "total_experiences" in cur_data

    # 2. Trigger tea break context summarize with custom notes
    sum_res = client.post("/api/context/summarize", json={
        "notes": "Ensure RAG cache validity before running evaluation loops.",
        "room": "teaBreakRoom"
    })
    assert sum_res.status_code == 200
    sum_data = sum_res.json()
    assert "id" in sum_data
    assert "task_summary" in sum_data
    assert "lesson" in sum_data

def test_meeting_sync():
    res = client.post("/api/meeting/sync", json={"topic": "Q3 Swarm Architecture Alignment"})
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "ok"
    assert "All-hands" in data["message"]

def test_direct_chat_mode():
    res = client.post("/api/chat", json={"message": "Hello Jordan, what can this office do?", "mode": "chat"})
    assert res.status_code == 200
    data = res.json()
    assert data["mode"] == "chat"
    assert "reply" in data
    assert len(data["reply"]) > 0
    assert "tokens" in data

def test_direct_chat_cowork_mode():
    res = client.post("/api/chat", json={"message": "Calculate 500 * 20 in cowork mode", "mode": "cowork"})
    assert res.status_code == 200
    data = res.json()
    assert data["mode"] == "cowork"
    assert data["status"] == "dispatched"
    assert data["task_id"].startswith("task_")

