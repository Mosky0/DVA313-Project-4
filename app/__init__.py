from flask import Flask, render_template
from flask_socketio import SocketIO

socketio = SocketIO(async_mode='eventlet')

def create_app():
    app = Flask(__name__)
    app.config.from_object("config.BaseConfig")
    socketio.init_app(app)

    # Register blueprints
    app.register_blueprint(main_bp)
    app.register_blueprint(metrics_bp)

    return app
