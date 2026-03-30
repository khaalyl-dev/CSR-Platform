"""Build public URL for user profile photos (same path convention as auth profile)."""
from typing import Optional


def user_avatar_serve_url(user) -> Optional[str]:
    if user is None:
        return None
    rel = getattr(user, "avatar_url", None)
    if not rel:
        return None
    return f"/api/documents/serve/{rel}"


def user_avatar_serve_url_for_id(user_id: Optional[str]) -> Optional[str]:
    if not user_id:
        return None
    from models import User

    u = User.query.get(user_id)
    return user_avatar_serve_url(u)
