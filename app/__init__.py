from flask import Flask
from flask_socketio import SocketIO

def create_app():
    app = Flask(__name__)
    app.config.from_object("config.BaseConfig")
    socketio = SocketIO(app, async_mode='eventlet')

    from app.routes.main import api
    app.register_blueprint(api)

    return app
