# Hướng dẫn demo CVE-2014-0160 (Heartbleed)

Demo này sử dụng **web đầy đủ (Spring Boot + MySQL + JWT + session)** trong thư mục
`BTL-AnToanMang` — KHÔNG dùng web tĩnh trong `build/web` (thư mục đó chỉ là bản sao
frontend tĩnh, login "giả", không có session cookie thật và hiện **không được phục vụ**
bởi bất kỳ service nào).

Toàn bộ luồng HTTPS đi qua một **reverse proxy chạy OpenSSL 1.0.1f** (bản lỗi Heartbleed).
Proxy giải mã TLS, đọc request dạng plaintext rồi chuyển tiếp sang backend Spring Boot.
Chính vì vậy, khi người dùng đăng nhập, username/password/cookie/session đều nằm trong
bộ nhớ tiến trình TLS và bị script khai thác đọc trộm.

## Kiến trúc

```
Trình duyệt  ──http──▶  nginx:80  ──▶ (302) /cve-heartbleed/
                           │
                           └─proxy_pass https://heartbleed-server:443  (OpenSSL 1.0.1f — LỖI)
                                        │
                                        ├─▶ springboot-app:8080  (web đầy đủ + MySQL)
                                        └─▶ bộ nhớ TLS chứa request plaintext → bị Heartbleed đọc trộm

Kẻ tấn công ──hb_loop.py──▶ heartbleed-server:8082 (gửi HeartbeatRequest độc hại)
```

## Các bước chạy demo

### 1. Khởi động Docker Desktop
Đảm bảo Docker daemon đang chạy (mở Docker Desktop và chờ trạng thái "Engine running").

### 2. Build và chạy toàn bộ stack
```powershell
cd E:\lab2-heartbleed
docker compose up --build -d
```

> Lần build đầu tiên sẽ biên dịch OpenSSL 1.0.1f từ mã nguồn (chậm, ~5–10 phút).
> Chờ đến khi cả 4 container ở trạng thái healthy/running:
```powershell
docker compose ps
```

### 3. Chạy script khai thác Heartbleed (để chạy liên tục)
Mở một terminal riêng (dùng Python 3 bất kỳ):
```powershell
cd E:\lab2-heartbleed
python build\hb_loop.py // chạy liên tục
python heartbleed_test.py 127.0.0.1 -p 8082 // chạy 1 lần
```
Script kết nối tới `127.0.0.1:8082`, gửi HeartbeatRequest độc hại và hiển thị dữ liệu
rò rỉ (cũng ghi vào `build\leaked_creds.txt`).

### 4. Đăng nhập trên trình duyệt
Mở **http://localhost/cve-heartbleed/** và đăng nhập bằng tài khoản demo:

- **Username:** `demo`
- **Password:** `demo123`

Sau khi đăng nhập, frontend tự động gọi `/api/heartbleed-demo/session` và vài lần
`/api/heartbleed-demo/ping` để tạo **JSESSIONID** + **HEARTBLEED_SESSION** và gửi
cookie qua proxy lỗi.

### 5. Quan sát dữ liệu rò rỉ
Trong terminal của `hb_loop.py`, bạn sẽ thấy các đoạn rò rỉ chứa:

- **Username / Password** (trong body JSON): `"username":"demo","password":"demo123"`
- **Session ID + Cookie**: `Cookie: HEARTBLEED_SESSION=...; JSESSIONID=...`
- **Authorization header** (Bearer JWT) nếu có

Ngoài ra có thể xem log phía server để thấy proxy đã bắt được gì:
```powershell
docker compose logs -f heartbleed-server
```
Các dòng `[lab] CAPTURED ...` / `[lab] LOGIN BODY ...` / `[lab] COOKIE ...` chứng minh
request đã bị đọc dạng plaintext trước khi bị chuyển tiếp.

## Giải thích cơ chế rò rỉ

1. OpenSSL 1.0.1f giữ một **freelist read-buffer** nội bộ: buffer giải mã TLS (~17 KB)
   được **tái sử dụng cùng một vùng nhớ** cho mọi kết nối.
2. Khi người dùng đăng nhập, request plaintext (gồm body chứa username/password và các
   header Cookie/Authorization) được ghi vào buffer đó.
3. Kết nối Heartbeat tiếp theo tái sử dụng đúng buffer này. Lỗi CVE-2014-0160 khiến
   server đọc tràn **~16 KB từ đầu record heartbeat trở đi**, và phần đuôi còn sót lại
   chính là request đăng nhập trước đó → **username, password, session id, cookie bị lộ**.

## Lưu ý
- Cổng: nginx `80`, Spring Boot `8080`, heartbleed-server `8082` (TLS 443 trong container).
- Chứng chỉ TLS của lab là self-signed; nginx tắt verify bằng `proxy_ssl_verify off`.
- Muốn demo lại: đăng nhập thêm lần nữa (hoặc dùng tài khoản khác) trong khi
  `hb_loop.py` vẫn đang chạy.
