from flask import Flask
from flask_socketio import SocketIO

socketio = SocketIO(async_mode='eventlet') 

def create_app():
    app = Flask(__name__)
    app.config.from_object("config.BaseConfig")
    socketio.init_app(app)
    
    from app.routes.main import api
    app.register_blueprint(api)

    return app
