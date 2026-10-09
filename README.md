# Manage Documents Application

Hệ thống quản lý và chia sẻ tài liệu an toàn xây dựng trên nền tảng **Spring Boot 3**, **Spring Security (JWT)**, **Spring Data JPA** và **MySQL**.

---

## 📋 Yêu Cầu Môi Trường
- **Java:** JDK 21+ (Đã hỗ trợ tương thích JDK 24)
- **Database:** MySQL 8.x+
- **Build Tool:** Maven (sử dụng sẵn `./mvnw`)

---

## ⚙️ Cấu Hình Biến Môi Trường (Environment Variables)

Hệ thống bảo mật đọc cấu hình nhạy cảm từ biến môi trường:

| Tên biến | Bắt buộc | Mặc định | Mô tả |
| :--- | :---: | :--- | :--- |
| `DB_PASSWORD` | **Có** | *Không có* | Mật khẩu tài khoản MySQL |
| `DB_USERNAME` | Không | `root` | Tên người dùng MySQL |
| `DB_URL` | Không | `jdbc:mysql://localhost:3306/managedocuments?createDatabaseIfNotExist=true&useSSL=false&allowPublicKeyRetrieval=true&serverTimezone=UTC` | JDBC URL kết nối MySQL |
| `JWT_SIGNER_KEY` | Không | *(64 hex characters)* | Khóa bí mật ký JWT (tối thiểu 256 bits) |
| `JWT_VALID_DURATION` | Không | `3600` | Thời hạn Access Token (giây) |
| `JWT_REFRESHABLE_DURATION` | Không | `604800` | Thời hạn Refresh Token (giây) |
| `FILE_UPLOAD_DIR` | Không | `uploads` | Thư mục lưu trữ file tài liệu |

### Thiết lập `DB_PASSWORD`:
- **Windows CMD (Vĩnh viễn):** `setx DB_PASSWORD "mat_khau_mysql"` *(Khởi động lại CMD sau khi gõ)*
- **Windows CMD (Tạm thời):** `set DB_PASSWORD=mat_khau_mysql`
- **PowerShell (Tạm thời):** `$env:DB_PASSWORD="mat_khau_mysql"`
- **Linux/macOS:** `export DB_PASSWORD="mat_khau_mysql"`

---

## 🚀 Khởi Chạy Ứng Dụng
```powershell
# Di chuyển vào thư mục backend rồi chạy qua Maven Wrapper:
cd backend
.\mvnw spring-boot:run
```
Base URL: `http://localhost:8080`

---

## 📁 Cấu Trúc Thư Mục

```
.
├── backend/                 # Mã nguồn Spring Boot (pom.xml, src, mvnw, uploads)
├── apache/                  # Cấu hình Apache httpd dùng làm reverse proxy
└── lab-cve-2023-25690/      # Lab demo CVE-2023-25690 (docker-compose, Dockerfile tham chiếu backend/ & apache/)
```

---

## 📖 ĐẶC TẢ API (API SPECIFICATION)

### 1. Chuẩn Dữ Liệu & Xác Thực
- **Định dạng dữ liệu:** `application/json` (trừ API upload file sử dụng `multipart/form-data` và download file trả về nhị phân `application/octet-stream`).
- **Xác thực:** Gửi Bearer Token qua header:
  ```http
  Authorization: Bearer <access_token>
  ```
- **Cấu trúc phản hồi chung (Response Envelope):**
  ```json
  {
    "code": 1000,
    "message": "Mô tả kết quả",
    "data": null
  }
  ```
  *(Mã `code = 1000` là thành công, các mã khác `1001 - 1017` hoặc `9999` là lỗi).*

---

### 2. Nhóm API Xác Thực & Phiên Làm Việc (`/api/auth`)

| Phương thức | Endpoint | Yêu cầu Auth | Mô tả |
| :--- | :--- | :---: | :--- |
| `POST` | `/api/auth/register` | Public | Đăng ký tài khoản người dùng mới |
| `POST` | `/api/auth/login?revokeOldSessions=false` | Public | Đăng nhập hệ thống, trả về Token & Refresh Token |
| `POST` | `/api/auth/refresh-token` | Public | Cấp lại Access Token từ Refresh Token hợp lệ |
| `POST` | `/api/auth/logout` | Public | Đăng xuất & đưa token vào danh sách thu hồi |
| `POST` | `/api/auth/revoke-old-sessions` | User / Admin | Thu hồi toàn bộ phiên đăng nhập cũ trên thiết bị khác |
| `POST` | `/api/auth/revoke-all-sessions` | User / Admin | Đăng xuất khỏi toàn bộ thiết bị hiện có |
| `POST` | `/api/auth/change-password` | User / Admin | Đổi mật khẩu tài khoản và hủy toàn bộ phiên cũ |
| `GET` | `/api/auth/my-info` | User / Admin | Lấy thông tin tài khoản và danh sách quyền hạn |

#### Chi tiết Request mẫu `/api/auth/login`:
```json
// Body:
{
  "username": "user1",
  "password": "Password@123"
}

// Response (200 OK):
{
  "code": 1000,
  "message": "Đăng nhập thành công",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiJ9...",
    "refreshToken": "7b8e9...",
    "authenticated": true
  }
}
```

---

### 3. Nhóm API Quản Lý Tài Liệu (`/api/documents`)

| Phương thức | Endpoint | Yêu cầu Auth | Mô tả |
| :--- | :--- | :---: | :--- |
| `POST` | `/api/documents` | User / Admin | **Upload tài liệu mới** (Multipart Form: `file`, `title`, `description`, `categoryId`, `isPublic`) |
| `GET` | `/api/documents` | Public / User | **Danh sách & Tìm kiếm**: lọc theo `keyword`, `categoryId`, `isPublic`, phân trang (`page`, `size`, `sort`) |
| `GET` | `/api/documents/my-documents` | User / Admin | **Tài liệu cá nhân**: Lấy danh sách tài liệu do chính user hiện tại đăng |
| `GET` | `/api/documents/{id}` | Public / Owner / Admin | Xem chi tiết thông tin tài liệu |
| `GET` | `/api/documents/{id}/download` | Public / Owner / Admin | **Tải xuống file đính kèm** của tài liệu |
| `PUT` | `/api/documents/{id}` | Owner / Admin | Cập nhật thông tin tài liệu (`title`, `description`, `categoryId`, `isPublic`) |
| `DELETE` | `/api/documents/{id}` | Owner / Admin | Xóa tài liệu khỏi database và xóa file vật lý trên ổ cứng |

#### Chi tiết Upload Tài Liệu (`POST /api/documents`):
- **Content-Type:** `multipart/form-data`
- **Form Data:**
  - `file`: File nhị phân (PDF, DOCX, ZIP, PNG,...) - Tối đa 50MB
  - `title`: `Báo cáo nghiên cứu an toàn mạng` *(String, bắt buộc)*
  - `description`: `Tài liệu phân tích chuyên sâu` *(String, tùy chọn)*
  - `categoryId`: `1` *(Integer, bắt buộc)*
  - `isPublic`: `true` hoặc `false` *(Boolean, mặc định false)*
- **Response mẫu (200 OK):**
  ```json
  {
    "code": 1000,
    "message": "Tải lên tài liệu thành công",
    "data": {
      "id": 1,
      "title": "Báo cáo nghiên cứu an toàn mạng",
      "description": "Tài liệu phân tích chuyên sâu",
      "fileName": "bao_cao.pdf",
      "fileUrl": "a3b1c9_bao_cao.pdf",
      "isPublic": true,
      "ownerUsername": "user1",
      "ownerId": 2,
      "categoryName": "Tài liệu học tập",
      "categoryId": 1,
      "createdAt": "2026-09-27T22:30:00",
      "updatedAt": "2026-09-27T22:30:00"
    }
  }
  ```

---

### 4. Nhóm API Danh Mục (`/api/categories`)

| Phương thức | Endpoint | Yêu cầu Auth | Mô tả |
| :--- | :--- | :---: | :--- |
| `GET` | `/api/categories` | Public | Lấy toàn bộ danh mục tài liệu |
| `GET` | `/api/categories/{id}` | Public | Lấy thông tin chi tiết một danh mục |
| `POST` | `/api/categories` | Admin | Tạo danh mục mới (`name`, `description`) |
| `PUT` | `/api/categories/{id}` | Admin | Cập nhật tên và mô tả danh mục |
| `DELETE` | `/api/categories/{id}` | Admin | Xóa danh mục |

---

### 5. Nhóm API Quản Trị Người Dùng (`/api/users`)

| Phương thức | Endpoint | Yêu cầu Auth | Mô tả |
| :--- | :--- | :---: | :--- |
| `GET` | `/api/users/profile` | User / Admin | Xem thông tin cá nhân của người dùng hiện tại |
| `PUT` | `/api/users/profile` | User / Admin | Cập nhật thông tin cá nhân (`email`, `fullName`) |
| `GET` | `/api/users` | Admin | Lấy danh sách tất cả người dùng trong hệ thống |
| `GET` | `/api/users/{id}` | Admin | Lấy thông tin chi tiết người dùng theo ID |
| `POST` | `/api/users` | Admin | Tạo người dùng mới và phân quyền |
| `PUT` | `/api/users/{id}` | Admin | Cập nhật thông tin người dùng |
| `PUT` | `/api/users/{id}/roles` | Admin | Gán danh sách vai trò cho người dùng |
| `DELETE` | `/api/users/{id}` | Admin | Xóa người dùng |

---

### 6. Nhóm API Phân Quyền & Vai Trò (`/api/roles` & `/api/permissions`)

| Phương thức | Endpoint | Yêu cầu Auth | Mô tả |
| :--- | :--- | :---: | :--- |
| `GET` | `/api/roles` | Admin | Lấy danh sách tất cả vai trò (Roles) |
| `POST` | `/api/roles` | Admin | Tạo vai trò mới kèm danh sách permissions |
| `PUT` | `/api/roles/{id}` | Admin | Cập nhật vai trò |
| `DELETE` | `/api/roles/{id}` | Admin | Xóa vai trò |
| `GET` | `/api/permissions` | Admin | Lấy danh sách tất cả quyền hạn (Permissions) |
| `POST` | `/api/permissions` | Admin | Tạo quyền hạn mới |
| `DELETE` | `/api/permissions/{id}` | Admin | Xóa quyền hạn |

---

## ⚠️ Bảng Mã Lỗi Hệ Thống (Error Codes)

| Mã lỗi | HTTP Status | Thông báo / Ý nghĩa |
| :---: | :---: | :--- |
| `1000` | 200 OK | Thành công |
| `1001` | 409 Conflict | Username hoặc Email đã tồn tại |
| `1002` | 404 Not Found | Không tìm thấy người dùng |
| `1003` | 401 Unauthorized | Xác thực thất bại / Thông tin đăng nhập không đúng |
| `1004` | 403 Forbidden | Bạn không có quyền truy cập tài nguyên này |
| `1005` | 404 Not Found | Không tìm thấy tài liệu |
| `1006` | 404 Not Found | Không tìm thấy danh mục |
| `1007` | 400 Bad Request | Tệp tải lên không hợp lệ hoặc chứa lỗi |
| `1008` | 400 Bad Request | Dữ liệu đầu vào không hợp lệ (Validation Error) |
| `1009` | 401 Unauthorized | Token không hợp lệ |
| `1010` | 401 Unauthorized | Token đã hết hạn |
| `1011` | 401 Unauthorized | Refresh token không tồn tại hoặc đã bị thu hồi |
| `1012` | 400 Bad Request | Mật khẩu cũ không chính xác |
| `1013` | 404 Not Found | Không tìm thấy vai trò |
| `1014` | 404 Not Found | Không tìm thấy quyền hạn |
| `1015` | 409 Conflict | Vai trò đã tồn tại |
| `1016` | 409 Conflict | Quyền hạn đã tồn tại |
| `1017` | 409 Conflict | Danh mục đã tồn tại |
| `9999` | 500 Server Error | Lỗi hệ thống chưa xác định |
