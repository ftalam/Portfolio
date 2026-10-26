from flask import Flask, jsonify, render_template
from portfolio_data import PROFILE, PROJECTS, CAPABILITIES, EXPERIENCE

app = Flask(__name__)


@app.get("/")
def index():
    return render_template(
        "index.html",
        profile=PROFILE,
        projects=PROJECTS,
        capabilities=CAPABILITIES,
        experience=EXPERIENCE,
    )


@app.get("/api/profile")
def profile():
    return jsonify(profile=PROFILE, projects=PROJECTS, capabilities=CAPABILITIES)


@app.get("/health")
def health():
    return jsonify(status="ok")


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8000, debug=False)
