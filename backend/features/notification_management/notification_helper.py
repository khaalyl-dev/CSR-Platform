"""
Notification helper - create notifications for users (in-app alerts).

Used when a plan is validated, an activity is approved/rejected, etc. Keeps max 100
notifications per user. Respects user preferences (e.g. notify_csr_plan_validation).
"""
import uuid
from core import db
from models import Notification, User, UserSite

def _uuid():
    return str(uuid.uuid4())

def _trim_user_notifications(user_id: str):
    """Delete oldest notifications so user has at most 100 (prevents unlimited growth)."""
    count = Notification.query.filter_by(user_id=user_id).count()
    if count < 100:
        return

    oldest = (
        Notification.query.filter_by(user_id=user_id)
        .order_by(Notification.created_at.asc())
        .limit(count - 99)
        .all()
    )
    for old in oldest:
        db.session.delete(old)


def _user_wants_notification(user, category):
    """Check if user has this notification category enabled."""
    if not category:
        return True
    if category == "csr_plan":
        return bool(user.notify_csr_plan_validation)
    if category == "activity_validation":
        return bool(user.notify_activity_validation)
    if category == "activity_reminders":
        return bool(user.notify_activity_reminders)
    return True


def notify_user(
    user_id: str,
    title: str,
    message: str,
    type: str = "info",
    site_id: str = None,
    entity_type: str = None,
    entity_id: str = None,
    notification_category: str = None,
):
    """Create a notification for a single user. Respects user notification preferences."""
    if not user_id:
        return

    user = User.query.filter_by(id=user_id, is_active=True).first()
    if not user:
        return

    if not _user_wants_notification(user, notification_category):
        return

    _trim_user_notifications(user.id)
    notif = Notification(
        id=_uuid(),
        user_id=user.id,
        site_id=site_id,
        title=title,
        message=message,
        type=type,
        entity_type=entity_type,
        entity_id=entity_id,
        is_read=False,
    )
    db.session.add(notif)
    db.session.commit()


def notify_site_users(
    site_id: str,
    title: str,
    message: str,
    type: str = "info",
    entity_type: str = None,
    entity_id: str = None,
    notification_category: str = None,
):
    """Create a notification for active SITE_USER accounts assigned to a site. Respects user notification preferences."""
    if not site_id:
        return

    users = (
        User.query
        .join(UserSite, UserSite.user_id == User.id)
        .filter(
            User.role == "SITE_USER",
            User.is_active.is_(True),
            UserSite.site_id == site_id,
            UserSite.is_active.is_(True),
        )
        .distinct()
        .all()
    )

    if not users:
        return

    for user in users:
        if not _user_wants_notification(user, notification_category):
            continue
        _trim_user_notifications(user.id)
        notif = Notification(
            id=_uuid(),
            user_id=user.id,
            site_id=site_id,
            title=title,
            message=message,
            type=type,
            entity_type=entity_type,
            entity_id=entity_id,
            is_read=False,
        )
        db.session.add(notif)

    db.session.commit()


def notify_corporate(
    title: str,
    message: str,
    type: str = "info",
    site_id: str = None,
    entity_type: str = None,
    entity_id: str = None,
    notification_category: str = None,
):
    """
    Crée une notification pour tous les utilisateurs CORPORATE_USER.
    Respecte les préférences de notification (csr_plan, activity_validation, activity_reminders).
    Si un utilisateur dépasse 100 notifications, supprime les plus anciennes.
    """
    corporate_users = User.query.filter_by(role="CORPORATE_USER", is_active=True).all()

    for user in corporate_users:
        if not _user_wants_notification(user, notification_category):
            continue
        _trim_user_notifications(user.id)

        # Créer la nouvelle notification
        notif = Notification(
            id=_uuid(),
            user_id=user.id,
            site_id=site_id,
            title=title,
            message=message,
            type=type,
            entity_type=entity_type,
            entity_id=entity_id,
            is_read=False,
        )
        db.session.add(notif)
    
    db.session.commit()