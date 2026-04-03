import secrets


def generate_public_id() -> str:
    """Generate a 10-character URL-safe random string for public-facing IDs."""
    return secrets.token_urlsafe(8)[:10]
