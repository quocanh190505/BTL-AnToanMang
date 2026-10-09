package managedocuments.example.managedocuments.controller;

import jakarta.validation.Valid;
import managedocuments.example.managedocuments.dto.request.AuthRequest;
import managedocuments.example.managedocuments.dto.request.ChangePasswordRequest;
import managedocuments.example.managedocuments.dto.request.LogoutRequest;
import managedocuments.example.managedocuments.dto.request.RefreshTokenRequest;
import managedocuments.example.managedocuments.dto.request.RegisterRequest;
import managedocuments.example.managedocuments.dto.response.ApiResponse;
import managedocuments.example.managedocuments.dto.response.AuthResponse;
import managedocuments.example.managedocuments.dto.response.UserResponse;
import managedocuments.example.managedocuments.service.AuthService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthService authService;

    public AuthController(AuthService authService) {
        this.authService = authService;
    }

    @PostMapping("/register")
    public ResponseEntity<ApiResponse<AuthResponse>> register(@Valid @RequestBody RegisterRequest request) {
        AuthResponse result = authService.register(request);
        return ResponseEntity.ok(ApiResponse.<AuthResponse>builder()
                .code(1000)
                .message("Đăng ký tài khoản thành công")
                .data(result)
                .build());
    }

    @PostMapping("/login")
    public ResponseEntity<ApiResponse<AuthResponse>> login(
            @Valid @RequestBody AuthRequest request,
            @RequestParam(name = "revokeOldSessions", defaultValue = "false") boolean revokeOldSessions
    ) {
        AuthResponse result = authService.login(request, revokeOldSessions);
        return ResponseEntity.ok(ApiResponse.<AuthResponse>builder()
                .code(1000)
                .message("Đăng nhập thành công")
                .data(result)
                .build());
    }

    @PostMapping("/refresh-token")
    public ResponseEntity<ApiResponse<AuthResponse>> refreshToken(@Valid @RequestBody RefreshTokenRequest request) {
        AuthResponse result = authService.refreshToken(request);
        return ResponseEntity.ok(ApiResponse.<AuthResponse>builder()
                .code(1000)
                .message("Làm mới token thành công")
                .data(result)
                .build());
    }

    @PostMapping("/logout")
    public ResponseEntity<ApiResponse<Void>> logout(@RequestBody LogoutRequest request) {
        authService.logout(request);
        return ResponseEntity.ok(ApiResponse.<Void>builder()
                .code(1000)
                .message("Đăng xuất thành công")
                .build());
    }

    @PostMapping("/revoke-old-sessions")
    public ResponseEntity<ApiResponse<Void>> revokeOldSessions(
            @AuthenticationPrincipal UserDetails userDetails,
            @RequestParam(name = "currentRefreshToken", required = false) String currentRefreshToken
    ) {
        authService.revokeOldSessions(userDetails.getUsername(), currentRefreshToken);
        return ResponseEntity.ok(ApiResponse.<Void>builder()
                .code(1000)
                .message("Xóa các phiên đăng nhập cũ thành công")
                .build());
    }

    @PostMapping("/revoke-all-sessions")
    public ResponseEntity<ApiResponse<Void>> revokeAllSessions(@AuthenticationPrincipal UserDetails userDetails) {
        authService.revokeAllSessions(userDetails.getUsername());
        return ResponseEntity.ok(ApiResponse.<Void>builder()
                .code(1000)
                .message("Đăng xuất khỏi tất cả thiết bị thành công")
                .build());
    }

    @PostMapping("/change-password")
    public ResponseEntity<ApiResponse<Void>> changePassword(
            @AuthenticationPrincipal UserDetails userDetails,
            @Valid @RequestBody ChangePasswordRequest request
    ) {
        authService.changePassword(userDetails.getUsername(), request);
        return ResponseEntity.ok(ApiResponse.<Void>builder()
                .code(1000)
                .message("Đổi mật khẩu thành công. Các phiên đăng nhập cũ đã được đăng xuất.")
                .build());
    }

    @GetMapping("/my-info")
    public ResponseEntity<ApiResponse<UserResponse>> getMyInfo(@AuthenticationPrincipal UserDetails userDetails) {
        UserResponse result = authService.getMyInfo(userDetails.getUsername());
        return ResponseEntity.ok(ApiResponse.<UserResponse>builder()
                .code(1000)
                .message("Lấy thông tin người dùng thành công")
                .data(result)
                .build());
    }
}
