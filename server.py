#!/usr/bin/env python3
"""Local server: serves the site and lets the page edit data.json.

Listens on 127.0.0.1 only. The public GitHub Pages copy has no API, so it stays read-only.
"""
import json
import threading
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

import brain

PORT = 8765
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
        if self.path == "/api/status":
            return self.send_json(200, push_state)
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


if __name__ == "__main__":
    handler = partial(Handler, directory=str(brain.ROOT))
    ThreadingHTTPServer(("127.0.0.1", PORT), handler).serve_forever()
