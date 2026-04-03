from pydantic_settings import BaseSettings
from pydantic import ConfigDict
from functools import lru_cache
from typing import List


class Settings(BaseSettings):
    model_config = ConfigDict(env_file=".env", extra="ignore")

    # App
    app_name: str = "Marketplace.aw"
    secret_key: str = "change_this_in_production"
    allowed_origins: str = "http://localhost,http://localhost:80"

    # Auth
    jwt_secret_key: str = "change_jwt_secret_in_production"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 60 * 24 * 7  # 1 week

    # Database
    database_url: str = "postgresql://marketplace_user:changeme@localhost:5432/marketplace"

    # Site domain
    domain: str = "localhost"
    site_url: str = "http://localhost"

    # Email — Scaleway TEM (smtp.tem.scw.cloud:587, STARTTLS)
    smtp_host: str = "smtp.tem.scw.cloud"
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    email_from: str = "noreply@marketplace.aw"
    support_email: str = "support@marketplace.aw"

    # Object storage (S3-compatible)
    objectstore_endpoint: str = ""
    objectstore_region: str = "nl-ams"
    objectstore_access_key: str = ""
    objectstore_secret_key: str = ""
    objectstore_bucket: str = ""
    objectstore_public_url: str = ""

    @property
    def resolved_objectstore_public_url(self) -> str:
        if self.objectstore_public_url:
            return self.objectstore_public_url.rstrip("/")
        if self.objectstore_bucket and self.objectstore_region:
            return f"https://{self.objectstore_bucket}.s3.{self.objectstore_region}.scw.cloud"
        return ""

    @property
    def objectstore_enabled(self) -> bool:
        return bool(
            self.objectstore_endpoint
            and self.objectstore_access_key
            and self.objectstore_secret_key
            and self.objectstore_bucket
        )

    @property
    def cors_origins(self) -> List[str]:
        return [o.strip() for o in self.allowed_origins.split(",")]


@lru_cache
def get_settings() -> Settings:
    return Settings()
