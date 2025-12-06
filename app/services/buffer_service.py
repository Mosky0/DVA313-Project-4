from flask import jsonify
from app.utils.ringBuffer import getStoredMetrics, getLatestContainerMetrics

@app.route('/api/containers/<container_id>/metrics/history')
def getContainerMetricsHistory(container_id):
    try:
        history = getStoredMetrics(container_id)
        return jsonify(history)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/containers/<container_id>/metrics/latest')
def getContainerLatestMetrics(container_id):
    try:
        latest = getLatestContainerMetrics(container_id)
        return jsonify(latest)
    except Exception as e:
        return jsonify({'error': str(e)}), 500