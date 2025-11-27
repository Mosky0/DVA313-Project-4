from flask import Flask, render_template
from flask_socketio import SocketIO

from flask_sqlalchemy import SQLAlchemy
db = SQLAlchemy()

from app.routes.main import main_bp
from app.routes.metrics import metrics_bp
from app.routes.healthCheck import health_bp
socketio = SocketIO(async_mode='eventlet')

def create_app():
    app = Flask(__name__)
    app.config.from_object("config.BaseConfig")
    db.init_app(app)
    socketio.init_app(app)

    # Register blueprints
    app.register_blueprint(main_bp)
    app.register_blueprint(metrics_bp)
    app.register_blueprint(health_bp)

    return app

