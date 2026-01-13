from flask import Blueprint, jsonify
from sqlalchemy import text
from app.models import db

health_bp = Blueprint("health", __name__)

# -----------------------------
# Basic health (human-friendly)
# -----------------------------
@health_bp.get("/health")
def health():
    return jsonify(
        status="ok",
        service="backend-api"
    ), 200


# -----------------------------
# Liveness probe
# -----------------------------
@health_bp.get("/health/live")
def liveness():
    """
    Used by Kubernetes livenessProbe.
    If this fails, the pod will be restarted.
    MUST be lightweight.
    """
    return jsonify(status="alive"), 200


# -----------------------------
# Readiness probe
# -----------------------------
@health_bp.get("/health/ready")
def readiness():
    """
    Used by Kubernetes readinessProbe.
    If this fails, traffic will stop being routed.
    Checks database connectivity.
    """
    try:
        # simple DB ping
        db.session.execute(text("SELECT 1"))
        return jsonify(status="ready"), 200
    except Exception as e:
        return jsonify(
            status="not-ready",
            error=str(e)
        ), 503