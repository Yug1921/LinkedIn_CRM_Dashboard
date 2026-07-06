"""
backend/app/core/config.py  — UPDATED
Only change: added FRONTEND_URL field (used by /auth/invite to build the link).
Everything else is identical to your original.
"""

from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    # App
    APP_ENV: str = "development"
    APP_HOST: str = "0.0.0.0"
    APP_PORT: int = 8000

    # Database
    DATABASE_URL: str

    # Auth
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 10080

    # CORS
    CORS_ORIGINS: str = "http://localhost:3000"

    # Frontend (used to build invite links)
    # Production default: https://linked-in-crm-dashboard.vercel.app
    # Override for local dev:  FRONTEND_URL=http://localhost:3000  in backend/.env
    # Set on Render dashboard: FRONTEND_URL=https://linked-in-crm-dashboard.vercel.app
    FRONTEND_URL: str = "https://linked-in-crm-dashboard.vercel.app"

    # OpenRouter AI
    OPENROUTER_API_KEY: str
    OPENROUTER_BASE_URL: str = "https://openrouter.ai/api/v1"
    OPENROUTER_MODEL: str = "openai/gpt-4o-mini"

    @property
    def cors_origins_list(self) -> List[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]

    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()
