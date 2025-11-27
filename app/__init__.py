from flask import Flask
from flask_socketio import SocketIO

# Create the global SocketIO instance first
socketio = SocketIO()   # let it auto-pick async mode


def create_app():
    app = Flask(__name__)
    app.config.from_object("config.BaseConfig")

    # Initialize SocketIO
    socketio.init_app(app)

    # Import blueprints after app & socketio exist
    from app.routes.main import main_bp
    from app.routes.metrics import metrics_bp

    # Register blueprints
    app.register_blueprint(main_bp)
    app.register_blueprint(metrics_bp)

    return app
