from flask import Blueprint, jsonify
import psycopg2


api = Blueprint("api", __name__)

@api.route("/")
def home():
    return "Connected to IED Monitoring API"


def get_db():
    # Connect to PostgreSQL database with psycopg2 library
    conn = psycopg2.connect(
        host="localhost",
        database="ied_monitoring",
        user="postgres",
        password="iedpass"
    )
    return conn


@api.route("/test-db")
def test_db():
    conn = get_db()
    cur = conn.cursor()
    cur.execute("SELECT 1;")
    result = cur.fetchone()
    cur.close()
    conn.close()
    return jsonify({"db_connected": True, "result": result[0]})


@api.route("/containers")
def list_containers():
    # Mock data for demonstration purposes
    containers = [
        {
            "name": "ied-1",
            "cpu_percent": 23.5,
            "gpu_percent": 0.0,
            "mem_mb": 256.0,
            "mem_percent": 35.0,
            "status": "running"
        },
        {
            "name": "ied-2",
            "cpu_percent": 78.2,
            "gpu_percent": 40.0,
            "mem_mb": 512.0,
            "mem_percent": 70.0,
            "status": "warning"
        },
        {
            "name": "ied-3",
            "cpu_percent": 5.0,
            "gpu_percent": 0.0,
            "mem_mb": 128.0,
            "mem_percent": 20.0,
            "status": "stopped"
        }
    ]

    return jsonify({"containers": containers})