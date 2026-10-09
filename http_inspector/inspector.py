#!/usr/bin/env python3
"""
HTTP Inspector — Proxy trung gian giữa Apache ↔ Backend
Ghi log mọi request/response để quan sát CVE-2023-25690
"""

import socket
import threading
import sys
import json
from datetime import datetime
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse
import io

UPSTREAM_HOST = "backend"
UPSTREAM_PORT = 8080
LISTEN_PORT = 8090
LOG_FILE = "/logs/inspector.log"

request_counter = 0
response_counter = 0
log_lock = threading.Lock()


def log_message(msg_type, content):
    """Ghi log với timestamp và counter"""
    global request_counter, response_counter

    with log_lock:
        timestamp = datetime.now().isoformat()

        if msg_type == "REQ":
            request_counter += 1
            counter_str = f"REQ #{request_counter}"
        else:
            response_counter += 1
            counter_str = f"RSP #{response_counter}"

        log_entry = f"[{timestamp}] {counter_str}\n{content}\n{'='*80}\n"

        # In ra stdout (docker logs sẽ bắt được)
        print(log_entry, file=sys.stdout, flush=True)

        # Ghi vào file
        try:
            with open(LOG_FILE, "a") as f:
                f.write(log_entry)
        except Exception as e:
            print(f"[ERROR] Cannot write log: {e}", file=sys.stderr, flush=True)


class HTTPInspectorHandler(BaseHTTPRequestHandler):
    """Handler cho mỗi HTTP request"""

    def log_message(self, format, *args):
        """Override để không spam logs"""
        pass

    def do_GET(self):
        self._handle_request()

    def do_POST(self):
        self._handle_request()

    def do_PUT(self):
        self._handle_request()

    def do_DELETE(self):
        self._handle_request()

    def do_HEAD(self):
        self._handle_request()

    def do_PATCH(self):
        self._handle_request()

    def do_OPTIONS(self):
        self._handle_request()

    def _handle_request(self):
        """Xử lý request, forward tới backend, ghi log"""

        # ===== LOG REQUEST =====
        request_line = f"{self.command} {self.path} {self.request_version}"
        headers_str = "\n".join([f"{k}: {v}" for k, v in self.headers.items()])

        # Đọc body nếu có
        content_length = self.headers.get('Content-Length', '0')
        body = ""
        if content_length != '0':
            try:
                body_bytes = self.rfile.read(int(content_length))
                body = body_bytes.decode('utf-8', errors='replace')
            except:
                pass

        req_log = f"{request_line}\n{headers_str}"
        if body:
            req_log += f"\n\n{body}"

        log_message("REQ", req_log)

        # ===== FORWARD TO BACKEND =====
        try:
            # Tạo connection tới backend
            backend_sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            backend_sock.connect((UPSTREAM_HOST, UPSTREAM_PORT))

            # Gửi request tới backend
            backend_request = f"{self.command} {self.path} {self.request_version}\r\n"

            # Gửi headers (loại bỏ Host header, thêm lại với backend)
            for header, value in self.headers.items():
                if header.lower() != 'host':
                    backend_request += f"{header}: {value}\r\n"
            backend_request += f"Host: {UPSTREAM_HOST}:{UPSTREAM_PORT}\r\n"
            backend_request += "\r\n"

            # Gửi request line + headers
            backend_sock.sendall(backend_request.encode())

            # Gửi body nếu có
            if body:
                backend_sock.sendall(body.encode() if isinstance(body, str) else body)

            # ===== RECEIVE RESPONSE FROM BACKEND =====
            response_data = b""
            while True:
                chunk = backend_sock.recv(4096)
                if not chunk:
                    break
                response_data += chunk

            backend_sock.close()

            # Parse response
            response_str = response_data.decode('utf-8', errors='replace')

            # ===== LOG RESPONSE =====
            log_message("RSP", response_str[:500])  # Log 500 chars đầu

            # ===== SEND RESPONSE TO CLIENT =====
            self.wfile.write(response_data)

        except Exception as e:
            error_msg = f"ERROR: {str(e)}"
            log_message("RSP", error_msg)

            self.send_response(502)
            self.send_header('Content-Type', 'text/plain')
            self.end_headers()
            self.wfile.write(error_msg.encode())


def run_inspector():
    """Khởi chạy HTTP Inspector server"""
    server_address = ('0.0.0.0', LISTEN_PORT)
    httpd = HTTPServer(server_address, HTTPInspectorHandler)

    print(f"[START] HTTP Inspector listening on 0.0.0.0:{LISTEN_PORT}", file=sys.stdout, flush=True)
    print(f"[START] Forwarding to {UPSTREAM_HOST}:{UPSTREAM_PORT}", file=sys.stdout, flush=True)
    print(f"[START] Logging to {LOG_FILE}", file=sys.stdout, flush=True)

    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print(f"[STOP] Inspector shutting down...", file=sys.stdout, flush=True)
        httpd.shutdown()


if __name__ == '__main__':
    run_inspector()
