package managedocuments.example.managedocuments.enums;

import lombok.Getter;
import org.springframework.http.HttpStatus;

@Getter
public enum ErrorCode {
    UNCATEGORIZED_EXCEPTION(9999, "Lỗi hệ thống chưa xác định", HttpStatus.INTERNAL_SERVER_ERROR),
    USER_EXISTED(1001, "Username hoặc Email đã tồn tại", HttpStatus.CONFLICT),
    USER_NOT_FOUND(1002, "Không tìm thấy người dùng", HttpStatus.NOT_FOUND),
    UNAUTHENTICATED(1003, "Xác thực thất bại / Thông tin đăng nhập không đúng", HttpStatus.UNAUTHORIZED),
    UNAUTHORIZED(1004, "Bạn không có quyền truy cập tài nguyên này", HttpStatus.FORBIDDEN),
    DOCUMENT_NOT_FOUND(1005, "Không tìm thấy tài liệu", HttpStatus.NOT_FOUND),
    CATEGORY_NOT_FOUND(1006, "Không tìm thấy danh mục", HttpStatus.NOT_FOUND),
    INVALID_FILE(1007, "Tệp tải lên không hợp lệ", HttpStatus.BAD_REQUEST),
    INVALID_KEY(1008, "Dữ liệu đầu vào không hợp lệ", HttpStatus.BAD_REQUEST),
    TOKEN_INVALID(1009, "Token không hợp lệ", HttpStatus.UNAUTHORIZED),
    TOKEN_EXPIRED(1010, "Token đã hết hạn", HttpStatus.UNAUTHORIZED),
    REFRESH_TOKEN_NOT_FOUND(1011, "Refresh token không tồn tại hoặc đã bị thu hồi", HttpStatus.UNAUTHORIZED),
    OLD_PASSWORD_NOT_MATCH(1012, "Mật khẩu cũ không chính xác", HttpStatus.BAD_REQUEST),
    ROLE_NOT_FOUND(1013, "Không tìm thấy vai trò", HttpStatus.NOT_FOUND),
    PERMISSION_NOT_FOUND(1014, "Không tìm thấy quyền hạn", HttpStatus.NOT_FOUND),
    ROLE_EXISTED(1015, "Vai trò đã tồn tại", HttpStatus.CONFLICT),
    PERMISSION_EXISTED(1016, "Quyền hạn đã tồn tại", HttpStatus.CONFLICT),
    CATEGORY_EXISTED(1017, "Danh mục đã tồn tại", HttpStatus.CONFLICT);

    private final int code;
    private final String message;
    private final HttpStatus httpStatus;

    ErrorCode(int code, String message, HttpStatus httpStatus) {
        this.code = code;
        this.message = message;
        this.httpStatus = httpStatus;
    }
}
