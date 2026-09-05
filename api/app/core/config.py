import os
from typing import List, Optional
from pydantic_settings import BaseSettings
from dotenv import load_dotenv

# Load from root or current dir .env
load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "../../../.env"))
load_dotenv()

class Settings(BaseSettings):
    PROJECT_NAME: str = "Faculty Substitution & Duty Allocation System"
    API_V1_STR: str = "/api/v1"
    
    # Security & Auth
    SECRET_KEY: str = os.getenv("SECRET_KEY", "institution_scheduling_secret_jwt_key_2026_production_grade")
    ALGORITHM: str = os.getenv("ALGORITHM", "HS256")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "1440"))
    
    # Database
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL",
        "sqlite:////tmp/faculty_scheduler.db" if os.getenv("VERCEL") else "sqlite:///./faculty_scheduler.db"
    )
    
    # Scheduling Non-negotiable Institutional Constraints (Configurable defaults)
    MAX_WEEKLY_SUBSTITUTIONS: int = int(os.getenv("MAX_WEEKLY_SUBSTITUTIONS", "4"))
    MAX_DAILY_REGULAR_CLASSES: int = int(os.getenv("MAX_DAILY_REGULAR_CLASSES", "2"))
    WEEK_START_DAY: int = int(os.getenv("WEEK_START_DAY", "0"))  # 0 = Monday, 6 = Sunday
    WEEK_END_DAY: int = int(os.getenv("WEEK_END_DAY", "6"))
    TIMEZONE: str = os.getenv("TIMEZONE", "Asia/Kolkata")
    INSTITUTION_NAME: str = os.getenv("INSTITUTION_NAME", "Apex Institute of Engineering & Technology")
    
    # AI - NVIDIA Nemotron Integration
    NVIDIA_API_KEY: Optional[str] = os.getenv("NVIDIA_API_KEY", "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")
    NVIDIA_MODEL: str = os.getenv("NVIDIA_MODEL", "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning")
    NVIDIA_INVOKE_URL: str = os.getenv("NVIDIA_INVOKE_URL", "https://integrate.api.nvidia.com/v1/chat/completions")
    
    # CORS
    BACKEND_CORS_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://localhost:5173",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:5173",
        "*"
    ]

    class Config:
        case_sensitive = True

settings = Settings()
