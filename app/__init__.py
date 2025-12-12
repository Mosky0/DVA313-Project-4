from flask_cors import CORS
from flask import Flask
from flask_socketio import SocketIO
from app.services.buffer_service import start_metrics_collection

socketio = SocketIO(cors_allowed_origins="*")


def create_app():
    app = Flask(__name__)
    app.config.from_object("config.BaseConfig")

    # Enable CORS for all API routes
    CORS(app, resources={
    r"/api/*": { #for getting petitions in frontend
        "origins": ["http://localhost:5173"], 
        "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        "allow_headers": ["Content-Type"]
    }
})

    # Initialize SocketIO after CORS
    socketio.init_app(app, cors_allowed_origins="*")

    # Start background service to fill metrics buffer
    start_metrics_collection()

    # Import blueprints
    from app.routes.main import main_bp
    from app.routes.metrics import metrics_bp

    # Register
    app.register_blueprint(main_bp)
    app.register_blueprint(metrics_bp)

    return app
