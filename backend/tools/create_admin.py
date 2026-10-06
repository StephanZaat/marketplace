"""Create an admin account, or reset an existing admin's password.

Run inside the backend container (prompts for the password, never echoes it):
    docker exec -it marketplace_backend python tools/create_admin.py <username> [--reset-2fa]

--reset-2fa disables TOTP for that admin (lost authenticator); set it up
again under /admin/security.
"""
import getpass
import sys

sys.path.insert(0, "/app")

from app.database import SessionLocal  # noqa: E402
from app.models.admin import Admin  # noqa: E402
from app.routers.admin_auth import hash_password  # noqa: E402


def main() -> None:
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    if len(args) != 1:
        sys.exit(__doc__)
    username = args[0].strip()
    password = getpass.getpass("New password: ")
    if len(password) < 12:
        sys.exit("Password must be at least 12 characters.")
    if getpass.getpass("Repeat password: ") != password:
        sys.exit("Passwords don't match.")

    db = SessionLocal()
    try:
        admin = db.query(Admin).filter(Admin.username == username).first()
        if admin is None:
            db.add(Admin(username=username, hashed_password=hash_password(password)))
            action = "created"
        else:
            admin.hashed_password = hash_password(password)
            action = "password reset"
            if "--reset-2fa" in sys.argv:
                admin.totp_enabled = False
                admin.totp_secret = None
                action += ", 2FA disabled"
        db.commit()
        print(f"Admin '{username}': {action}.")
    finally:
        db.close()


if __name__ == "__main__":
    main()
