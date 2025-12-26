from flask_cors import CORS
from flask import Flask
from flask_socketio import SocketIO
from app.services.buffer_service import start_metrics_collection
from app.services.container_stats_background_service import start_container_stats_collection
from app.utils.loggerConfig import InitializeLogger

logger = InitializeLogger(__name__)
socketio = SocketIO(cors_allowed_origins="*")


def create_app():
    app = Flask(__name__)
    app.config.from_object("config.BaseConfig")

    CORS(app, resources={r"/api/*": {"origins": "*"}})
    socketio.init_app(app)

    try:
        start_metrics_collection()
        start_container_stats_collection()
    except Exception as e:
        logger.error(f"Failed to start background services: {e}")

    from app.routes.main import main_bp
    from app.routes.metrics import metrics_bp

    app.register_blueprint(main_bp)
    app.register_blueprint(metrics_bp)

    return app
