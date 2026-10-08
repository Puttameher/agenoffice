import sqlite3
import json
from pathlib import Path
from backend.app.config import settings

def get_db_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(settings.SQLITE_DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # 1. Agents table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS agents (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        role TEXT NOT NULL,
        description TEXT NOT NULL,
        instructions TEXT NOT NULL,
        skills TEXT NOT NULL,       -- JSON array
        tools TEXT NOT NULL,        -- JSON array
        permanent INTEGER NOT NULL DEFAULT 1,
        memory_enabled INTEGER NOT NULL DEFAULT 1,
        status TEXT NOT NULL DEFAULT 'idle',
        desk_id INTEGER NOT NULL DEFAULT 1,
        level INTEGER NOT NULL DEFAULT 1,
        xp INTEGER NOT NULL DEFAULT 0,
        badges TEXT NOT NULL DEFAULT '[]',
        tasks_completed INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL
    )
    """)
    
    # 2. Tasks table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        user_input TEXT NOT NULL,
        assigned_agent_id TEXT,
        collaborating_agent_id TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        result TEXT,
        retries INTEGER NOT NULL DEFAULT 0,
        tokens_used INTEGER NOT NULL DEFAULT 0,
        latency_ms REAL NOT NULL DEFAULT 0.0,
        cost_usd REAL NOT NULL DEFAULT 0.0,
        artifacts TEXT,
        created_at TEXT NOT NULL,
        completed_at TEXT
    )
    """)

    # Safe column migrations for existing SQLite databases
    agent_cols = [
        ("level", "INTEGER NOT NULL DEFAULT 1"),
        ("xp", "INTEGER NOT NULL DEFAULT 0"),
        ("badges", "TEXT NOT NULL DEFAULT '[]'"),
        ("tasks_completed", "INTEGER NOT NULL DEFAULT 0")
    ]
    for col, col_type in agent_cols:
        try:
            cursor.execute(f"ALTER TABLE agents ADD COLUMN {col} {col_type}")
        except Exception:
            pass

    task_cols = [
        ("collaborating_agent_id", "TEXT"),
        ("tokens_used", "INTEGER NOT NULL DEFAULT 0"),
        ("latency_ms", "REAL NOT NULL DEFAULT 0.0"),
        ("cost_usd", "REAL NOT NULL DEFAULT 0.0"),
        ("artifacts", "TEXT")
    ]
    for col, col_type in task_cols:
        try:
            cursor.execute(f"ALTER TABLE tasks ADD COLUMN {col} {col_type}")
        except Exception:
            pass
    
    # 3. Evaluations table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS evaluations (
        id TEXT PRIMARY KEY,
        task_id TEXT NOT NULL,
        success INTEGER NOT NULL,
        score REAL NOT NULL,
        reason TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (task_id) REFERENCES tasks (id)
    )
    """)
    
    # 4. Feedback table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS feedback (
        id TEXT PRIMARY KEY,
        task_id TEXT NOT NULL,
        rating INTEGER NOT NULL,
        comment TEXT,
        created_at TEXT NOT NULL,
        FOREIGN KEY (task_id) REFERENCES tasks (id)
    )
    """)
    
    # 5. Memories table (Agent persistent memory)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS memories (
        id TEXT PRIMARY KEY,
        agent_id TEXT NOT NULL,
        key TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (agent_id) REFERENCES agents (id)
    )
    """)
    
    # 6. Experiences table (Cross-agent experience learning)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS experiences (
        id TEXT PRIMARY KEY,
        task_summary TEXT NOT NULL,
        strategy TEXT NOT NULL,
        what_worked TEXT NOT NULL,
        what_failed TEXT NOT NULL,
        feedback TEXT,
        lesson TEXT NOT NULL,
        created_at TEXT NOT NULL
    )
    """)
    
    # 7. Events table (Real-time backend events log)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS events (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        agent_id TEXT,
        task_id TEXT,
        timestamp TEXT NOT NULL,
        metadata TEXT NOT NULL      -- JSON object
    )
    """)

    # 8. Task Steps table (tracks each atomic step inside a task)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS task_steps (
        id TEXT PRIMARY KEY,
        task_id TEXT NOT NULL,
        agent_id TEXT,
        tool_id TEXT,
        step_input TEXT,
        step_output TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        retry_count INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL
    )
    """)

    # 9. Tools table (registry of all available tools with permissions)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS tools (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        description TEXT NOT NULL,
        permission_policy TEXT NOT NULL DEFAULT 'restricted',
        enabled INTEGER NOT NULL DEFAULT 1,
        call_count INTEGER NOT NULL DEFAULT 0,
        last_used TEXT
    )
    """)

    # 10. Artifacts table (files and outputs produced by tasks)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS artifacts (
        id TEXT PRIMARY KEY,
        task_id TEXT NOT NULL,
        artifact_type TEXT NOT NULL DEFAULT 'file',
        path TEXT,
        reference TEXT,
        metadata TEXT,
        created_at TEXT NOT NULL
    )
    """)

    # 11. Skills table (reusable learned procedures with versioning)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS skills (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        description TEXT NOT NULL,
        procedure TEXT NOT NULL,
        required_tools TEXT NOT NULL DEFAULT '[]',
        version INTEGER NOT NULL DEFAULT 1,
        status TEXT NOT NULL DEFAULT 'active',
        learned_corrections TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
    )
    """)

    conn.commit()
    conn.close()
