import pytest
import json
import asyncio
from httpx import AsyncClient, ASGITransport
from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.database.db import init_db
from backend.app.database.repository import Repository
from backend.app.events.event_bus import event_bus
from backend.app.models.schemas import OfficeEvent

@pytest.fixture(autouse=True)
def setup_db():
    init_db()

client = TestClient(app)

def test_p1_health_check():
    """Verify /health returns 200 with proper status, provider, and database state."""
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert "Jev Office" in data["app"]
    assert "version" in data
    assert data["database"] == "connected"
    assert "llm_provider" in data
    assert data["llm_provider"] in ["groq", "openrouter", "openai", "ollama"]

def test_p1_chat_direct_sync():
    """Verify POST /api/chat returns immediate response."""
    payload = {
        "message": "Hello Jordan, what is the office status?",
        "stream": False
    }
    response = client.post("/api/chat", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "reply" in data
    assert len(data["reply"]) > 0
    assert "task_id" in data

def test_p1_chat_streamed_sse():
    """Verify POST /api/chat with stream=True returns real streamed SSE tokens."""
    payload = {
        "message": "Summarize the office capabilities in one short phrase.",
        "stream": True
    }
    with client.stream("POST", "/api/chat", json=payload) as response:
        assert response.status_code == 200
        assert "text/event-stream" in response.headers.get("content-type", "")
        
        lines = [line for line in response.iter_lines() if line]
        assert len(lines) >= 2
        data_lines = [l for l in lines if l.startswith("data: ")]
        assert len(data_lines) >= 2
        assert any("[DONE]" in l for l in data_lines)

def test_p1_sse_events_stream():
    """Verify GET /api/events connects and streams event feed."""
    with client.stream("GET", "/api/events?limit=1") as response:
        assert response.status_code == 200
        assert "text/event-stream" in response.headers.get("content-type", "")
        lines = [line for line in response.iter_lines() if line]
        assert len(lines) >= 1
        assert ": connected" in lines[0]

def test_p1_websocket_events():
    """Verify WebSocket connection at /api/ws/events receives emitted events from /api/chat."""
    with client.websocket_connect("/api/ws/events") as websocket:
        # Trigger an action that emits events
        client.post("/api/chat", json={"message": "WebSocket ping check"})
        
        # Read event from websocket
        data = websocket.receive_text()
        event_json = json.loads(data)
        assert "type" in event_json
        assert event_json["type"] in ["ROUTE_DECIDED", "DIRECT_CHAT_MESSAGE", "TASK_CREATED"]

def test_p1_decision_logging_sqlite():
    """Verify decision persistence to SQLite."""
    test_decision = {
        "id": "dec_test_001",
        "input_hash": "hash_abc_123",
        "prompt": "Test prompt for decision logging",
        "route": "DIRECT",
        "confidence": 0.95,
        "choice": "DIRECT",
        "score": 1.0,
        "noul": 0.05,
        "probabilities": {"DIRECT": 0.95, "TOOL": 0.03, "MANAGER": 0.02},
        "decider": "llm",
        "latency_ms": 45.2,
        "created_at": "2026-10-16T16:00:00Z"
    }
    Repository.save_decision(test_decision)
    decisions = Repository.get_decisions(limit=10)
    assert len(decisions) >= 1
    found = next((d for d in decisions if d["id"] == "dec_test_001"), None)
    assert found is not None
    assert found["route"] == "DIRECT"
    assert found["confidence"] == 0.95
    assert found["probabilities"]["DIRECT"] == 0.95
