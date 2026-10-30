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
FIELDS = ("sleep", "clarity", "desire")

_lock = threading.Lock()


def read():
    return json.loads(DATA.read_text())


def validate(changes):
    if not isinstance(changes, dict):
        raise ValueError("expected a JSON object")
    clean = {}
    for key, value in changes.items():
        if key not in FIELDS:
            raise ValueError(f"unknown field: {key}")
        x = float(value)
        if not 0 <= x <= 1:
            raise ValueError(f"{key} must be between 0 and 1")
        clean[key] = round(x, 4)
    if not clean:
        raise ValueError("give at least one of " + ", ".join(FIELDS))
    return clean


def update(changes):
    """Write validated changes to data.json and commit. Returns the new data."""
    changes = validate(changes)
    with _lock:
        data = read()
        now = datetime.now(BJ)
        data.update(changes)
        if "sleep" in changes:
            data["sleepDate"] = now.strftime("%Y-%m-%d")
        data["updatedAt"] = now.isoformat(timespec="seconds")
        DATA.write_text(json.dumps(data, indent=2) + "\n")
        git("add", "data.json")
        git("commit", "-q", "-m", "update: " + " ".join(f"{k}={v}" for k, v in changes.items()))
    return data


def push(retries=3):
    """Push to origin, retrying because the connection to GitHub is flaky."""
    with _lock:
        for attempt in range(retries):
            try:
                result = subprocess.run(["git", "-C", str(ROOT), "push", "-q"],
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


def git(*args):
    subprocess.run(["git", "-C", str(ROOT), *args], check=True, capture_output=True, text=True)
