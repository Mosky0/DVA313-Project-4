from flask import Blueprint, jsonify
from app import db

health_bp = Blueprint("health", __name__, url_prefix="/status")

@health_bp.route('/ping', methods=['GET'])
def ping_check():
    return jsonify({"status": "OK"}), 200

@health_bp.route('/db-health', methods=['GET'])
def db_health_check():
    try:
        db.session.execute(db.text('SELECT 1'))
        return jsonify({"database": "healthy"}), 200
    except Exception as e:
        return jsonify({"database": f"unhealthy error {e}"}), 500