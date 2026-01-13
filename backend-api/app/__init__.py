from flask import Flask, jsonify
from flask_cors import CORS
from flask_jwt_extended import JWTManager
from .routes.metrics import metrics_bp

from .config import Config
from .models import db


def create_app(config_class=Config):
    app = Flask(__name__)
    app.config.from_object(config_class)

    CORS(app)

    jwt = JWTManager(app)
    db.init_app(app)

    # ✅ IMPORTANT: JWT error callbacks (prevents 500 on missing/invalid token)

    @jwt.unauthorized_loader
    def unauthorized_callback(reason):
        # Missing Authorization Header
        return jsonify(error=reason or "Missing Authorization Header"), 401

    @jwt.invalid_token_loader
    def invalid_token_callback(reason):
        # Token is malformed / bad signature / wrong type, etc.
        return jsonify(error=reason or "Invalid token"), 422

    @jwt.expired_token_loader
    def expired_token_callback(jwt_header, jwt_payload):
        return jsonify(error="Token has expired"), 401

    @jwt.revoked_token_loader
    def revoked_token_callback(jwt_header, jwt_payload):
        return jsonify(error="Token has been revoked"), 401

    @jwt.needs_fresh_token_loader
    def fresh_token_required_callback(jwt_header, jwt_payload):
        return jsonify(error="Fresh token required"), 401

    from .routes.api import api_bp
    from .routes.health import health_bp
    from .routes.auth import auth_bp

    app.register_blueprint(api_bp, url_prefix="/api")
    app.register_blueprint(health_bp)
    app.register_blueprint(auth_bp, url_prefix="/auth")
    app.register_blueprint(metrics_bp)

    with app.app_context():
        db.create_all()

    return app