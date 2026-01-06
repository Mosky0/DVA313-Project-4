import os
from flask import Flask, send_from_directory
from flask_cors import CORS
from flask_socketio import SocketIO
from app.services.buffer_service import start_metrics_collection
from app.services.container_stats_background_service import start_container_stats_collection
from app.utils.loggerConfig import InitializeLogger

logger = InitializeLogger(__name__)
socketio = SocketIO(cors_allowed_origins="*")

def create_app():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    dist_dir = os.path.join(base_dir, "..", "frontend", "dist")

    app = Flask(__name__, static_folder=None)

    app.config.from_object("config.BaseConfig")

    CORS(app, resources={r"/api/*": {"origins": "*"}})
    socketio.init_app(app)

    try:
        start_metrics_collection()
        start_container_stats_collection()
    except Exception as e:
        logger.error(f"Failed to start background services: {e}")
        raise RuntimeError("Critical background services failed to start.")

    from app.routes.metrics import metrics_bp

    app.register_blueprint(metrics_bp)

    @app.route("/", defaults={"path": ""})
    @app.route("/<path:path>")
    def frontend(path):
        # Do not serve index.html for API routes
        if path.startswith("api/"):
            return {"error": "Not Found"}, 404

        # If the requested file exists in the build output, serve it (e.g., /assets/*)
        requested_path = os.path.join(dist_dir, path)
        if path and os.path.exists(requested_path):
            return send_from_directory(dist_dir, path)

        # Otherwise, serve the SPA entrypoint
        return send_from_directory(dist_dir, "index.html")



    return app
