#!/usr/bin/env python
"""
Initialize MySQL database with sample users and sites.

Run once to set up tables and add test data:
    python init_db.py
"""
from datetime import datetime

from app import create_app
from core.db import db
from models import User, Site, UserSite


def init_db():
    app = create_app()
    with app.app_context():
        db.create_all()
        print("✓ Database tables created")

        sample_users = [
            {"email": "user@test.com", "password": "password123", "role": "SITE_USER", "first_name": "Site", "last_name": "User"},
            {"email": "admin@test.com", "password": "admin123", "role": "CORPORATE_USER", "first_name": "Corporate", "last_name": "Admin"},
            {"email": "john@example.com", "password": "john123", "role": "SITE_USER", "first_name": "John", "last_name": "Doe"},
        ]
        added = 0
        for u in sample_users:
            if User.query.filter_by(email=u["email"]).first():
                continue
            user = User(
                email=u["email"],
                password_hash=User.hash_password(u["password"]),
                role=u["role"],
                first_name=u["first_name"],
                last_name=u["last_name"],
            )
            db.session.add(user)
            added += 1
        db.session.commit()
        if added:
            print(f"✓ Added {added} user(s)")
        else:
            print("✓ All sample users already exist")
        print("\nTest credentials:")
        for u in sample_users:
            print(f"  - {u['email']} / {u['password']} ({u['role']})")

        # Sample sites
        sample_sites = [
            {"name": "Tunis Plant", "code": "COFTN", "region": "North Africa", "country": "Tunisia", "location": "Tunis"},
            {"name": "Sfax Factory", "code": "COFSF", "region": "North Africa", "country": "Tunisia", "location": "Sfax"},
            {"name": "Gabes Facility", "code": "COFGB", "region": "North Africa", "country": "Tunisia", "location": "Gabes"},
            {"name": "Sousse Hub", "code": "COFSS", "region": "North Africa", "country": "Tunisia", "location": "Sousse"},
            {"name": "Bizerte Unit", "code": "COFBZ", "region": "North Africa", "country": "Tunisia", "location": "Bizerte"},
        ]
        sites_added = 0
        for s in sample_sites:
            if Site.query.filter_by(code=s["code"]).first():
                continue
            site = Site(
                name=s["name"],
                code=s["code"],
                region=s["region"],
                country=s["country"],
                location=s["location"],
                is_active=True,
            )
            db.session.add(site)
            sites_added += 1
        db.session.commit()
        if sites_added:
            print(f"✓ Added {sites_added} site(s)")

        # Assign sites to site users (user@test.com, john@example.com)
        site_user_emails = ["user@test.com", "john@example.com"]
        admin_user = User.query.filter_by(email="admin@test.com").first()
        for email in site_user_emails:
            u = User.query.filter_by(email=email).first()
            if not u or u.role != "SITE_USER":
                continue
            # Assign first 2 sites to user@test.com, first 3 to john@example.com
            site_limit = 2 if email == "user@test.com" else 3
            sites = Site.query.order_by(Site.code).limit(site_limit).all()
            for site in sites:
                existing = UserSite.query.filter_by(user_id=u.id, site_id=site.id).first()
                if not existing:
                    us = UserSite(
                        user_id=u.id,
                        site_id=site.id,
                        is_active=True,
                        granted_by=admin_user.id if admin_user else None,
                        granted_at=datetime.utcnow(),
                    )
                    db.session.add(us)
        db.session.commit()
        print("✓ Site access assigned to sample users")


if __name__ == "__main__":
    init_db()
