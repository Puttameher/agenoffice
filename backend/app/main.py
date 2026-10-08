from contextlib import asynccontextmanager
from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from backend.app.config import settings, BASE_DIR
from backend.app.database.db import init_db
from backend.app.database.repository import Repository
from backend.app.models.schemas import AgentConfig, SkillRecord
from backend.app.api.routes import router as api_router
from backend.app.retrieval.rag_service import rag_service

def seed_initial_agents():
    seed_agents = [
        AgentConfig(
            id="agent_alex_01",
            name="Alex",
            role="Coding Agent",
            description="Expert in Python script development, algorithms, backend architecture, and debugging.",
            instructions="Write clean, performant code, use safe sandbox execution, and explain architecture clearly.",
            skills=["Python", "coding", "debugging", "algorithm design"],
            tools=["python_runner", "calculator"],
            permanent=True,
            memory_enabled=True,
            status="idle",
            desk_id=1
        ),
        AgentConfig(
            id="agent_nova_02",
            name="Nova",
            role="Research Agent",
            description="Specializes in deep research, market trends, literature synthesis, and factual verification.",
            instructions="Conduct thorough investigations, synthesize facts accurately from retrieved company documents, and cite sources.",
            skills=["research", "market trends", "document synthesis", "fact checking"],
            tools=["calculator"],
            permanent=True,
            memory_enabled=True,
            status="idle",
            desk_id=2
        ),
        AgentConfig(
            id="agent_rio_03",
            name="Rio",
            role="Analysis Agent",
            description="Handles quantitative analysis, financial forecasting, statistics, and metric evaluations.",
            instructions="Analyze datasets, compounding, financial projections, and metrics with rigorous mathematical precision.",
            skills=["financial modeling", "data analysis", "budgeting", "statistics"],
            tools=["calculator", "python_runner"],
            permanent=True,
            memory_enabled=True,
            status="idle",
            desk_id=3
        ),
        AgentConfig(
            id="agent_mika_04",
            name="Mika",
            role="Content Agent",
            description="Specializes in technical writing, blog posts, documentation, and storytelling.",
            instructions="Craft engaging, well-structured articles, blog posts, and user documentation.",
            skills=["content writing", "blog posts", "documentation", "copywriting"],
            tools=["calculator"],
            permanent=True,
            memory_enabled=True,
            status="idle",
            desk_id=4
        ),
        AgentConfig(
            id="agent_zane_05",
            name="Zane",
            role="Design Agent",
            description="Focuses on UI/UX mockups, presentation design, visual layout, and product aesthetic systems.",
            instructions="Design clear visual hierarchies, compelling slide decks, and user-centric workflows.",
            skills=["UI/UX design", "presentation design", "creative layout", "branding"],
            tools=["calculator"],
            permanent=True,
            memory_enabled=True,
            status="idle",
            desk_id=5
        ),
        AgentConfig(
            id="agent_taro_06",
            name="Taro",
            role="Operations Agent",
            description="Oversees workflow orchestration, pipeline reliability, health checks, and task automation.",
            instructions="Maintain system reliability, schedule operational sequences, and verify delivery standards.",
            skills=["operations", "workflow management", "system health", "automation"],
            tools=["python_runner", "calculator"],
            permanent=True,
            memory_enabled=True,
            status="idle",
            desk_id=6
        ),
        # New agents from PDF PRD
        AgentConfig(
            id="agent_kai_07",
            name="Kai",
            role="Browser Agent",
            description="Navigates websites, fills forms, uploads files, extracts data, and verifies completion using browser automation.",
            instructions="Use browser tools to navigate sites, extract data, fill forms, and confirm successful actions. Always emit verification events after important browser actions.",
            skills=["browser automation", "web scraping", "form filling", "data extraction"],
            tools=["browser", "form_filler", "laptop_file_reader"],
            permanent=True,
            memory_enabled=True,
            status="idle",
            desk_id=7
        ),
        AgentConfig(
            id="agent_luna_08",
            name="Luna",
            role="Knowledge Agent",
            description="Manages memory compression, human-readable notes, skill updates, and organizational knowledge capture.",
            instructions="Compress task episodes into concise experiences, save discoveries to the Obsidian vault, and propose skill updates when patterns are detected.",
            skills=["memory management", "knowledge compression", "obsidian notes", "skill learning"],
            tools=["obsidian", "laptop_file_reader"],
            permanent=True,
            memory_enabled=True,
            status="idle",
            desk_id=8
        )
    ]
    seeded = 0
    for agent in seed_agents:
        if not Repository.get_agent(agent.id):
            Repository.save_agent(agent)
            seeded += 1
    if seeded > 0:
        print(f"[Init] Seeded {seeded} new permanent agents.")
    else:
        print("[Init] All permanent agents already exist — skipping seed.")


def seed_skills_from_files():
    """Read existing SKILL.md files from backend/skills/ and seed them into the DB."""
    import uuid
    from datetime import datetime, timezone

    skills_root = BASE_DIR.parent / "skills"
    if not skills_root.exists():
        skills_root = BASE_DIR / "skills"
    if not skills_root.is_dir():
        return

    seeded = 0
    now = datetime.now(timezone.utc).isoformat()
    for skill_dir in skills_root.iterdir():
        skill_md = skill_dir / "SKILL.md"
        if not skill_dir.is_dir() or not skill_md.exists():
            continue
        skill_name = skill_dir.name.replace("-", " ").replace("_", " ").title()
        # Skip if already in DB
        if Repository.get_skill_by_name(skill_name):
            continue
        try:
            content = skill_md.read_text(encoding="utf-8")
            lines = [l.strip() for l in content.splitlines() if l.strip()]
            description = lines[0].lstrip("# ") if lines else "No description."
            skill = SkillRecord(
                id=f"skill_{uuid.uuid4().hex[:8]}",
                name=skill_name,
                description=description,
                procedure=content,
                required_tools=[],
                version=1,
                status="active",
                created_at=now,
                updated_at=now
            )
            Repository.save_skill(skill)
            seeded += 1
        except Exception as e:
            print(f"[Skills] Could not seed {skill_dir.name}: {e}")

    if seeded > 0:
        print(f"[Init] Seeded {seeded} skills from SKILL.md files.")

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    init_db()
    seed_initial_agents()
    seed_skills_from_files()  # Seed existing SKILL.md files into DB
    Repository.reset_agents_to_idle()  # Fix stuck 'working'/'assigned' states from prior crash
    rag_service.initialize_documents()
    print("[Startup] Agentic AI Office initialized successfully.")
    yield
    # Shutdown
    print("[Shutdown] Office server stopping.")

app = FastAPI(
    title=settings.APP_NAME,
    version=settings.VERSION,
    lifespan=lifespan
)

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API Router (both with /api prefix and root fallback)
app.include_router(api_router, prefix="/api")
app.include_router(api_router)

# Mount Frontend Static Assets
frontend_dir = BASE_DIR.parent / "frontend"
if frontend_dir.exists():
    app.mount("/", StaticFiles(directory=str(frontend_dir), html=True), name="frontend")
