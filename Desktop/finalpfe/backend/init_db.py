#!/usr/bin/env python
"""
Initialize MySQL database with sample users.

Run this once to set up the database schema and add test users.
"""

import os
from app import create_app, db, User
from dotenv import load_dotenv

load_dotenv()

def init_db():
  """Create all tables and add sample users."""
  app = create_app()
  
  with app.app_context():
    # Create tables
    db.create_all()
    print("✓ Database tables created")
    
    # Check if users already exist
    existing_users = User.query.all()
    if existing_users:
      print(f"✓ Database already has {len(existing_users)} user(s)")
      return
    
    # Add sample users with roles
    sample_users = [
      {
        "email": "user@test.com",
        "password": "password123",
        "role": "site"
      },
      {
        "email": "admin@test.com",
        "password": "admin123",
        "role": "corporate"
      },
      {
        "email": "john@example.com",
        "password": "john123",
        "role": "site"
      }
    ]
    
    for user_data in sample_users:
      user = User(
        email=user_data["email"],
        password_hash=User.hash_password(user_data["password"]),
        role=user_data["role"]
      )
      db.session.add(user)
    
    db.session.commit()
    print(f"✓ Added {len(sample_users)} sample users")
    print("\nTest credentials:")
    for user_data in sample_users:
      print(f"  - {user_data['email']} / {user_data['password']} ({user_data['role']} role)")

if __name__ == "__main__":
  init_db()
