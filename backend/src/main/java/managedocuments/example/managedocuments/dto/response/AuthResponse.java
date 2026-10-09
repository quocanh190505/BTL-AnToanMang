package managedocuments.example.managedocuments.dto.response;



import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AuthResponse {

    private String token;             // Tương thích ngược nếu client gọi trường token cũ
    private String accessToken;       // Chuẩn bearer token
    private String refreshToken;      // Dùng để refresh phiên đăng nhập
    private String tokenType;         // "Bearer"
    private long expiresIn;           // Thời gian sống của access token (ms hoặc s)
    private long refreshExpiresIn;    // Thời gian sống của refresh token
    private UserResponse user;        // Profile cơ bản kèm role/authorities
}