from datetime import datetime, timezone, timedelta

def _parse_docker_ts(ts: str) -> datetime | None:
    if not ts or ts.startswith("0001-01-01T00:00:00"):
        return None
    if ts.endswith("Z"):
        ts = ts[:-1] + "+00:00"
    if "." in ts:
        head, frac = ts.split(".", 1)
        frac, tail = (frac.split("+", 1) + ["00:00"])[:2]
        frac = frac[:6].ljust(6, "0")
        ts = f"{head}.{frac}+{tail}"
    return datetime.fromisoformat(ts)

def container_uptime_info(container):
    container.reload()
    state = (container.attrs or {}).get("State", {})

    started_at = _parse_docker_ts(state.get("StartedAt", ""))
    finished_at = _parse_docker_ts(state.get("FinishedAt", ""))

    now = datetime.now(timezone.utc)

    # running uptime
    if container.status == "running" and started_at:
        seconds = max(0, int((now - started_at).total_seconds()))
        return {
            "uptime_seconds": seconds,
            "uptime": str(timedelta(seconds=seconds)),   # ✅ fixed
            "started_at": started_at.isoformat(),
        }

    # stopped runtime duration
    if started_at and finished_at and finished_at > started_at:
        seconds = max(0, int((finished_at - started_at).total_seconds()))
        return {
            "uptime_seconds": seconds,
            "uptime": str(timedelta(seconds=seconds)),   # ✅ fixed
            "started_at": started_at.isoformat(),
            "finished_at": finished_at.isoformat(),
        }

    return {
        "uptime_seconds": 0,
        "uptime": "0:00:00",
    }
