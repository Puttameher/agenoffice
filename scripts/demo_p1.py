import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import json
import time
from fastapi.testclient import TestClient
from backend.app.main import app

def run_p1_proof():
    client = TestClient(app)
    
    print("=" * 65)
    print("PHASE 1 PROOF: JEV OFFICE SKELETON")
    print("=" * 65)

    # 1. Health check
    print("\n1. GET /health:")
    health_res = client.get("/health")
    print(f"Status: {health_res.status_code}")
    print("Payload:", json.dumps(health_res.json(), indent=2))

    # 2. WebSocket event listening & Chat dispatch
    print("\n2. Connect to /api/ws/events and dispatch /api/chat:")
    with client.websocket_connect("/api/ws/events") as ws:
        # Stream chat
        print("\n3. POST /api/chat (stream=True):")
        with client.stream("POST", "/api/chat", json={"message": "Report status of the office", "stream": True}) as stream_res:
            print(f"Response status: {stream_res.status_code}")
            print(f"Content-Type: {stream_res.headers.get('content-type')}")
            print("\n--- Streamed Tokens (SSE) ---")
            for line in stream_res.iter_lines():
                if line:
                    print(line)

        # Read event from WebSocket
        print("\n--- Event Received on WebSocket (/api/ws/events) ---")
        ws_msg = ws.receive_text()
        print(json.dumps(json.loads(ws_msg), indent=2))

    # 4. SSE /api/events endpoint
    print("\n4. GET /api/events?limit=2 (Auxiliary SSE stream):")
    with client.stream("GET", "/api/events?limit=2") as sse_res:
        print(f"Response status: {sse_res.status_code}")
        for line in sse_res.iter_lines():
            if line:
                print(line)

    print("\n" + "=" * 65)
    print("PHASE 1 PROOF COMPLETED SUCCESSFULLY")
    print("=" * 65)

if __name__ == "__main__":
    run_p1_proof()
