"""Shared logic for updating data.json and publishing it to GitHub."""
import json
import subprocess
import threading
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent
DATA = ROOT / "data.json"
BJ = timezone(timedelta(hours=8))
# left: remaining share of today's budget at leftAt; it then decays linearly to 0 at midnight.
FIELDS = ("sleep", "clarity", "desire", "left")

_lock = threading.Lock()


def read():
    return json.loads(DATA.read_text())


def validate(changes):
    if not isinstance(changes, dict):
        raise ValueError("expected a JSON object")
    clean = {}
    changes = dict(changes)
    # Client-side timestamps in epoch ms: leftAt (when left was set), at (version stamp).
    for key in ("leftAt", "at"):
        ms = changes.pop(key, None)
        if ms is None:
            continue
        t = datetime.fromtimestamp(float(ms) / 1000, BJ)
        if abs((t - datetime.now(BJ)).total_seconds()) > 3600:
            raise ValueError(f"{key} must be within an hour of now")
        clean[key] = t
    if "leftAt" in clean and "left" not in changes:
        raise ValueError("leftAt needs left")
    for key, value in changes.items():
        if key not in FIELDS:
            raise ValueError(f"unknown field: {key}")
        x = float(value)
        if not 0 <= x <= 1:
            raise ValueError(f"{key} must be between 0 and 1")
        clean[key] = round(x, 4)
    if not set(clean) & set(FIELDS):
        raise ValueError("give at least one of " + ", ".join(FIELDS))
    return clean


def update(changes):
    """Write validated changes to data.json and commit. Returns the new data."""
    changes = validate(changes)
    with _lock:
        data = read()
        now = changes.pop("at", None) or datetime.now(BJ)
        left_at = changes.pop("leftAt", None) or now
        data.update(changes)
        if "sleep" in changes:
            data["sleepDate"] = now.strftime("%Y-%m-%d")
        if "left" in changes:
            data["leftAt"] = left_at.isoformat(timespec="seconds")
        data["updatedAt"] = now.isoformat(timespec="seconds")
        DATA.write_text(json.dumps(data, indent=2) + "\n")
        git("add", "data.json")
        stamp = now.strftime("%Y-%m-%d %H:%M:%S")
        git("commit", "-q", "-m", f"update {stamp}: " + " ".join(f"{k}={v}" for k, v in changes.items()))
    return data


def push(retries=3):
    """Push to origin, retrying because the connection to GitHub is flaky."""
    with _lock:
        for attempt in range(retries):
            try:
                # HTTP/2 to github.com keeps failing on this network; HTTP/1.1 works.
                result = subprocess.run(["git", "-C", str(ROOT), "-c", "http.version=HTTP/1.1", "push", "-q"],
                                        capture_output=True, text=True, timeout=90)
            except subprocess.TimeoutExpired:
                error = "git push timed out after 90s"
                continue
            if result.returncode == 0:
                return
            error = result.stderr.strip() or "git push failed"
            if attempt < retries - 1:
                time.sleep(3)
    raise RuntimeError(error)


def unpushed():
    """Number of local commits not yet on origin/main."""
    out = subprocess.run(["git", "-C", str(ROOT), "rev-list", "--count", "origin/main..HEAD"],
                         capture_output=True, text=True)
    return int(out.stdout) if out.returncode == 0 else None


def git(*args):
    subprocess.run(["git", "-C", str(ROOT), *args], check=True, capture_output=True, text=True)
