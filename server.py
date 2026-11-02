#!/usr/bin/env python3
"""Local server: serves the site and lets the page edit data.json.

Listens on 127.0.0.1 only. The public GitHub Pages copy has no API, so it stays read-only.
"""
import json
import os
import signal
import subprocess
import threading
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

import brain
import summary

PORT = 8765
MENUBAR_LABEL = "com.wuhaonan.usage-menubar"  # same as menubar/install.py
ALLOWED_HOSTS = {f"localhost:{PORT}", f"127.0.0.1:{PORT}"}

push_state = {"state": "idle", "error": None}


def push_in_background():
    push_state.update(state="pushing", error=None)
    try:
        brain.push()
        push_state["state"] = "pushed"
    except Exception as e:
        push_state.update(state="failed", error=str(e))


class Handler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def log_message(self, fmt, *args):
        pass

    def send_json(self, status, body):
        payload = json.dumps(body).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def trusted(self):
        # Block requests from other websites: they cannot fake Host, and a JSON
        # content type forces a CORS preflight that this server never approves.
        return (self.headers.get("Host") in ALLOWED_HOSTS
                and self.headers.get("Content-Type", "").startswith("application/json"))

    def do_GET(self):
        if self.path == "/api/summary":
            return self.send_json(200, summary.summary())
        if self.path == "/api/status":
            return self.send_json(200, {**push_state, "unpushed": brain.unpushed()})
        super().do_GET()

    def do_POST(self):
        if self.path != "/api/update":
            return self.send_json(404, {"error": "not found"})
        if not self.trusted():
            return self.send_json(403, {"error": "forbidden"})
        try:
            length = int(self.headers.get("Content-Length", 0))
            data = brain.update(json.loads(self.rfile.read(length) or b"{}"))
        except ValueError as e:
            return self.send_json(400, {"error": str(e)})
        except Exception as e:
            return self.send_json(500, {"error": str(e)})
        threading.Thread(target=push_in_background, daemon=True).start()
        self.send_json(200, {"data": data})


def menubar_job(action):
    """The menu bar app follows this server: started with it, stopped with it.
    launchctl fails when the menu bar app is not installed; that is fine."""
    target = f"gui/{os.getuid()}/{MENUBAR_LABEL}"
    args = ["kickstart", target] if action == "start" else ["kill", "SIGTERM", target]
    try:
        subprocess.run(["launchctl", *args], capture_output=True, timeout=10)
    except (OSError, subprocess.SubprocessError):
        pass


if __name__ == "__main__":
    handler = partial(Handler, directory=str(brain.ROOT))
    server = ThreadingHTTPServer(("127.0.0.1", PORT), handler)
    # launchd stops the job with SIGTERM; shutdown() must run on another thread to avoid deadlock
    signal.signal(signal.SIGTERM, lambda *_: threading.Thread(target=server.shutdown).start())
    menubar_job("start")
    try:
        server.serve_forever()
    finally:
        menubar_job("stop")
