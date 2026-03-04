import uuid
from core import db
from models import Notification, User

def _uuid():
    return str(uuid.uuid4())

def notify_corporate(title: str, message: str, type: str = "info", site_id: str = None):
    """
    Crée une notification pour tous les utilisateurs CORPORATE_USER.
    Si un utilisateur dépasse 100 notifications, supprime les plus anciennes.
    """
    corporate_users = User.query.filter_by(role="CORPORATE_USER", is_active=True).all()
    
    for user in corporate_users:
        # Vérifier le nombre de notifications existantes
        count = Notification.query.filter_by(user_id=user.id).count()
        
        if count >= 100:
            # Supprimer les plus anciennes pour garder 99
            oldest = Notification.query.filter_by(user_id=user.id)\
                .order_by(Notification.created_at.asc())\
                .limit(count - 99)\
                .all()
            for old in oldest:
                db.session.delete(old)

        # Créer la nouvelle notification
        notif = Notification(
            id=_uuid(),
            user_id=user.id,
            site_id=site_id,
            title=title,
            message=message,
            type=type,
            is_read=False,
        )
        db.session.add(notif)
    
    db.session.commit()