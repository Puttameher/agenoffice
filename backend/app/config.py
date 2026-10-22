import os
from pathlib import Path
from pydantic import BaseModel
from dotenv import load_dotenv

# Load .env file from project root
load_dotenv()

BASE_DIR = Path(__file__).resolve().parent.parent.parent  # agenoffice/
BACKEND_DIR = BASE_DIR / "backend"
DATA_DIR = BACKEND_DIR / "data"
WORKSPACE_DIR = BASE_DIR / "workspaces"
SANDBOX_DIR = WORKSPACE_DIR / "sandbox"
VAULT_DIR = BASE_DIR / "vault"
SKILLS_DIR = BACKEND_DIR / "skills"

# Ensure runtime directories exist
DATA_DIR.mkdir(parents=True, exist_ok=True)
SANDBOX_DIR.mkdir(parents=True, exist_ok=True)
VAULT_DIR.mkdir(parents=True, exist_ok=True)
SKILLS_DIR.mkdir(parents=True, exist_ok=True)

class Settings(BaseModel):
    APP_NAME: str = "Jev Office"
    VERSION: str = "1.0.0"
    DEBUG: bool = os.getenv("DEBUG", "false").lower() == "true"
    
    # LLM Settings
    LLM_PROVIDER: str = os.getenv("LLM_PROVIDER", "groq")  # groq | openrouter | openai | ollama
    
    # Groq API
    GROQ_API_KEY: str = os.getenv("GROQ_API_KEY", "")
    GROQ_BASE_URL: str = os.getenv("GROQ_BASE_URL", "https://api.groq.com/openai/v1")
    GROQ_MODEL: str = os.getenv("GROQ_MODEL", "openai/gpt-oss-120b")
    
    # OpenRouter API
    OPENROUTER_API_KEY: str = os.getenv("OPENROUTER_API_KEY", "")
    OPENROUTER_BASE_URL: str = os.getenv("OPENROUTER_BASE_URL", "https://openrouter.ai/api/v1")
    OPENROUTER_MODEL: str = os.getenv("OPENROUTER_MODEL", "nousresearch/hermes-3-llama-3.1-70b")
    
    # TypeSafe System One (Jev)
    TYPESAFE_API_KEY: str = os.getenv("TYPESAFE_API_KEY", "")
    TYPESAFE_BASE_URL: str = os.getenv("TYPESAFE_BASE_URL", "https://api.typesafe.ai")
    TYPESAFE_MODEL: str = os.getenv("TYPESAFE_MODEL", "jev-latest")
    
    # Legacy / OpenAI fallback
    OPENAI_API_KEY: str = os.getenv("OPENAI_API_KEY", "")
    OPENAI_BASE_URL: str = os.getenv("OPENAI_BASE_URL", "")
    OPENAI_MODEL_NAME: str = os.getenv("OPENAI_MODEL_NAME", "gpt-4o-mini")
    
    # Paths
    SQLITE_DB_PATH: str = str(DATA_DIR / "office.db")
    SANDBOX_DIR_PATH: str = str(SANDBOX_DIR)
    VAULT_DIR_PATH: str = str(VAULT_DIR)
    SKILLS_DIR_PATH: str = str(SKILLS_DIR)
    
    # Routing & Execution Limits
    CONFIDENCE_THRESHOLD: float = float(os.getenv("CONFIDENCE_THRESHOLD", "0.70"))
    MAX_EVAL_RETRIES: int = int(os.getenv("MAX_EVAL_RETRIES", "2"))
    MAX_STEPS: int = int(os.getenv("MAX_STEPS", "8"))
    HEADLESS: bool = os.getenv("HEADLESS", "false").lower() == "true"

settings = Settings()
