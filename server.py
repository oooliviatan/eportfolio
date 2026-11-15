#!/usr/bin/env python3
"""Local server for the e-portfolio with live JSON sync."""

from __future__ import annotations

import json
import os
import threading
import time
from http.server import HTTPServer, SimpleHTTPRequestHandler

ROOT = os.path.dirname(os.path.abspath(__file__))
DATA_FILE = os.path.join(ROOT, "data", "daily-reports.json")
HOST = "127.0.0.1"
DEFAULT_PORT = 8765

_last_server_write = 0.0


def file_revision() -> float:
    try:
        return os.path.getmtime(DATA_FILE)
    except OSError:
        return 0.0


def read_data() -> dict:
    if not os.path.isfile(DATA_FILE):
        return {"overview": {}, "dailyReports": []}
    with open(DATA_FILE, encoding="utf-8") as handle:
        return json.load(handle)


def write_data(payload: dict) -> None:
    global _last_server_write
    os.makedirs(os.path.dirname(DATA_FILE), exist_ok=True)
    with open(DATA_FILE, "w", encoding="utf-8") as handle:
        json.dump(payload, handle, indent=2, ensure_ascii=False)
        handle.write("\n")
    _last_server_write = time.time()


def with_meta(body: dict) -> dict:
    return {
        **body,
        "meta": {
            "fileRevision": file_revision(),
            "path": "data/daily-reports.json",
        },
    }


def watch_data_file() -> None:
    """Log when the JSON file is edited outside the browser (e.g. in the IDE)."""
    last_rev = file_revision()
    while True:
        time.sleep(1.0)
        rev = file_revision()
        if rev == last_rev:
            continue
        if time.time() - _last_server_write > 0.8:
            print(
                f"[FILE] {DATA_FILE} changed on disk — "
                "browser will refresh on next sync (about 1–2 s)."
            )
        last_rev = rev


class PortfolioHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def log_message(self, format: str, *args) -> None:
        print(f"[{self.log_date_time_string()}] {format % args}")

    def end_headers(self) -> None:
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def do_GET(self) -> None:
        if self.path == "/api/internship-data":
            data = read_data()
            self._json_response(200, with_meta(data))
            return
        super().do_GET()

    def do_POST(self) -> None:
        if self.path != "/api/internship-data":
            self.send_error(404)
            return

        length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(length).decode("utf-8") if length else "{}"
        try:
            payload = json.loads(body)
        except json.JSONDecodeError:
            self._json_response(400, {"error": "Invalid JSON"})
            return

        if "overview" not in payload or "dailyReports" not in payload:
            self._json_response(
                400,
                {"error": "Payload must include overview and dailyReports"},
            )
            return

        write_data(payload)
        count = len(payload.get("dailyReports") or [])
        print(f"[SAVE] Updated {DATA_FILE} ({count} daily report(s) from browser UI)")
        self._json_response(
            200,
            {
                "ok": True,
                "message": "Saved to data/daily-reports.json",
                "fileRevision": file_revision(),
            },
        )

    def _json_response(self, status: int, payload: dict) -> None:
        encoded = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(encoded)))
        self.end_headers()
        self.wfile.write(encoded)


def main() -> None:
    threading.Thread(target=watch_data_file, daemon=True).start()

    port = DEFAULT_PORT
    server = None
    for attempt in range(DEFAULT_PORT, DEFAULT_PORT + 10):
        try:
            server = HTTPServer((HOST, attempt), PortfolioHandler)
            port = attempt
            break
        except OSError as exc:
            if exc.errno != 48:
                raise
            if attempt == DEFAULT_PORT:
                print(
                    f"Port {DEFAULT_PORT} is already in use — "
                    f"try opening http://{HOST}:{DEFAULT_PORT}/ first, "
                    "or stop the old server (see README)."
                )
    if server is None:
        raise SystemExit("No free port found between 8765 and 8774.")

    url = f"http://{HOST}:{port}/"
    print(f"\nE-Portfolio running at:\n  {url}\n")
    print("Live sync: edit in the browser → auto-saves to data/daily-reports.json")
    print("           edit that JSON in Cursor/VS Code → page updates every ~1.5 s")
    print("Press Ctrl+C to stop.\n")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nServer stopped.")
        server.server_close()


if __name__ == "__main__":
    main()
