#!/usr/bin/env python
"""
Initialize the database - creates all tables and loads test data.

Run this script once when setting up a new database:
    python init_db.py

What it does:
1. Creates all tables (users, sites, categories, etc.) if they don't exist
2. Adds default CSR categories (Environment, Social, Gouvernance, etc.)
3. Adds sample users (admin@test.com, user@test.com, john@example.com)
4. Adds sample sites (Tianjin, Durrango, etc.)
5. Assigns sites to users with validation grades (level_1, level_2)
"""
from datetime import datetime

from app import create_app
from core.db import db
from models import User, Site, UserSite, Category


def init_db():
    """
    Initialize the database: create tables and seed with default categories, users, and sites.

    Safe to run multiple times - skips adding data that already exists.
    """
    # Create the Flask app so we can use db.create_all() and db.session
    app = create_app()
    with app.app_context():
        # Create all tables defined in models (users, sites, categories, etc.)
        db.create_all()
        print("✓ Database tables created")

        # Default CSR categories
        if Category.query.count() == 0:
            for name in ["Environment", "Social", "Gouvernance", "Education", "Santé"]:
                db.session.add(Category(name=name))
            db.session.commit()
            print("✓ Categories added (Environment, Social, Gouvernance, Education, Santé)")
        else:
            print("✓ Categories already exist")

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

        # Sample sites — aligned with "2024 CSR Consolidated Report Form (1).xlsx". Plant = site name (for Excel import matching).
        sample_sites = [
            {"name": "Tianjin", "code": "COFCN", "region": "ASIA", "country": "China", "location": "Tianjin"},
            {"name": "Durrango", "code": "COFMX", "region": "America", "country": "Mexico", "location": "Durrango"},
            {"name": "Honduras", "code": "COFHN", "region": "America", "country": "Mexico", "location": "Honduras"},
            {"name": "Juarez", "code": "COFJU", "region": "America", "country": "Mexico", "location": "Juarez"},
            {"name": "Léon", "code": "COFLN", "region": "America", "country": "Mexico", "location": "Léon"},
            {"name": "Ploeisti", "code": "COFRO", "region": "EE", "country": "Romania", "location": "Ploeisti"},
            {"name": "Romania", "code": "COFRO2", "region": "EE", "country": "Romania", "location": "Romania"},
            {"name": "Serbia", "code": "COFRS", "region": "EE", "country": "Serbia", "location": "Serbia"},
            {"name": "Kenitra", "code": "COFMA", "region": "North Africa", "country": "Morocco", "location": "Kenitra"},
            {"name": "Tangier", "code": "COFKT", "region": "North Africa", "country": "Morocco", "location": "Tangier"},
            {"name": "Mdjez el beb", "code": "COFMD", "region": "North Africa", "country": "Tunisia", "location": "Mdjez el beb"},
            {"name": "Tunis", "code": "COFTN", "region": "North Africa", "country": "Tunisia", "location": "Tunis"},
            {"name": "Guarda", "code": "COFPT", "region": "western Europe", "country": "Portugal", "location": "Guarda"},
            {"name": "Guarda 2", "code": "COFPT2", "region": "western Europe", "country": "Portugal", "location": "Guarda 2"},
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

        # Assign sites to site users (user@test.com, john@example.com) with level_1
        site_user_emails = ["user@test.com", "john@example.com"]
        admin_user = User.query.filter_by(email="admin@test.com").first()
        for email in site_user_emails:
            u = User.query.filter_by(email=email).first()
            if not u or u.role != "SITE_USER":
                continue
            # Assign first 2 sites to user@test.com, first 3 to john@example.com; grade = level_1
            site_limit = 2 if email == "user@test.com" else 3
            sites = Site.query.order_by(Site.code).limit(site_limit).all()
            for site in sites:
                existing = UserSite.query.filter_by(user_id=u.id, site_id=site.id).first()
                if not existing:
                    us = UserSite(
                        user_id=u.id,
                        site_id=site.id,
                        is_active=True,
                        grade="level_1",
                        granted_by=admin_user.id if admin_user else None,
                        granted_at=datetime.utcnow(),
                    )
                    db.session.add(us)
                else:
                    existing.grade = "level_1"

        # Assign admin (corporate) to first site with level_2 for validation reference
        if admin_user:
            first_site = Site.query.order_by(Site.code).first()
            if first_site:
                admin_us = UserSite.query.filter_by(user_id=admin_user.id, site_id=first_site.id).first()
                if not admin_us:
                    us = UserSite(
                        user_id=admin_user.id,
                        site_id=first_site.id,
                        is_active=True,
                        grade="level_2",
                        granted_by=admin_user.id,
                        granted_at=datetime.utcnow(),
                    )
                    db.session.add(us)
                else:
                    admin_us.grade = "level_2"

        db.session.commit()
        print("✓ Site access assigned (level_1 for site users, level_2 for admin)")


if __name__ == "__main__":
    init_db()
