from flask import Blueprint, request, jsonify
from flask_jwt_extended import create_access_token
from werkzeug.security import generate_password_hash, check_password_hash

from app.models import db
from app.models.user import User

auth_bp = Blueprint("auth", __name__)

@auth_bp.post("/register")
def register():
    data = request.get_json() or {}
    username = data.get("username")
    password = data.get("password")

    if not username or not password:
        return {"error": "username and password are required"}, 400

    if User.query.filter_by(username=username).first():
        return {"error": "username already exists"}, 409

    user = User(
        username=username,
        password_hash=generate_password_hash(password)  # stable hashing
    )
    db.session.add(user)
    db.session.commit()

    return {"message": "registered"}, 201


@auth_bp.post("/login")
def login():
    data = request.get_json() or {}
    username = data.get("username")
    password = data.get("password")

    if not username or not password:
        return {"error": "username and password are required"}, 400

    user = User.query.filter_by(username=username).first()
    if not user or not check_password_hash(user.password_hash, password):
        return {"error": "invalid credentials"}, 401

    token = create_access_token(identity=str(user.id))
    return jsonify(access_token=token), 200