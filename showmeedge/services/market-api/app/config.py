from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "ShowMeEdge Market API"
    allowed_origins: str = "http://localhost:3000,http://localhost:3001"
    questdb_host: str = "localhost"
    questdb_pg_port: int = 8812
    questdb_user: str = "admin"
    questdb_password: str = "quest"
    questdb_database: str = "qdb"

    @property
    def cors_origins(self) -> list[str]:
        return [origin.strip() for origin in self.allowed_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()

