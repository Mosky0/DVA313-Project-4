from flask import Blueprint, render_template

main_bp = Blueprint("main", __name__)

@main_bp.route("/")
def metrics_page():
    return render_template("metrics.html")


@api.route("/")
def home():
    return "Hello"
