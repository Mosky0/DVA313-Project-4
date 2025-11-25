from flask import Flask
from app.routes.main import main_bp
from app.routes.metrics import metrics_bp

def create_app():
    app = Flask(__name__)
    app.config.from_object("config.BaseConfig")

    # Register blueprints
    app.register_blueprint(main_bp)
    app.register_blueprint(metrics_bp)

    return app
