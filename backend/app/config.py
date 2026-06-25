from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql+asyncpg://salon:salon@localhost:5432/salon_marketplace"
    secret_key: str = "dev-secret-change-in-production"
    access_token_expire_minutes: int = 60 * 24 * 7  # 7 days
    cors_origins: str = "http://localhost:5173"
    # Allow any Vercel deployment (production + previews) without listing each URL
    cors_origin_regex: str = r"https://.*\.vercel\.app"
    google_api_key: str = ""
    mcp_server_url: str = "http://127.0.0.1:8000/mcp"
    llm_model: str = "gemini-2.5-flash"
    llm_model_fallback: str = "gemini-2.5-flash-lite"
    agent_session_max_events: int = 20
    agent_search_limit: int = 10
    agent_slot_days: int = 7
    agent_slot_limit: int = 24
    rate_limit_enabled: bool = True
    rate_limit_per_minute: int = 120
    rate_limit_write_per_minute: int = 40
    rate_limit_auth_per_minute: int = 10
    rate_limit_agent_per_minute: int = 20

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


settings = Settings()
