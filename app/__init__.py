from flask import Flask

def create_app():
    app = Flask(__name__)
    app.config.from_object("config.BaseConfig")

    from app.routes.main import api
    app.register_blueprint(api)

    return app
