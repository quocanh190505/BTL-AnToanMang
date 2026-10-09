package managedocuments.example.managedocuments.controller;

import jakarta.validation.Valid;
import managedocuments.example.managedocuments.dto.request.UpdateProfileRequest;
import managedocuments.example.managedocuments.dto.request.UserCreationRequest;
import managedocuments.example.managedocuments.dto.request.UserUpdateRequest;
import managedocuments.example.managedocuments.dto.response.ApiResponse;
import managedocuments.example.managedocuments.dto.response.UserResponse;
import managedocuments.example.managedocuments.service.UserService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Set;

@RestController
@RequestMapping("/api/users")
public class UserController {

    private final UserService userService;

    public UserController(UserService userService) {
        this.userService = userService;
    }

    @GetMapping("/profile")
    public ResponseEntity<ApiResponse<UserResponse>> getProfile(@AuthenticationPrincipal UserDetails userDetails) {
        UserResponse response = userService.getProfile(userDetails.getUsername());
        return ResponseEntity.ok(ApiResponse.<UserResponse>builder()
                .code(1000)
                .message("Lấy thông tin cá nhân thành công")
                .data(response)
                .build());
    }

    @PutMapping("/profile")
    public ResponseEntity<ApiResponse<UserResponse>> updateProfile(
            @AuthenticationPrincipal UserDetails userDetails,
            @Valid @RequestBody UpdateProfileRequest request
    ) {
        UserResponse response = userService.updateProfile(userDetails.getUsername(), request);
        return ResponseEntity.ok(ApiResponse.<UserResponse>builder()
                .code(1000)
                .message("Cập nhật thông tin cá nhân thành công")
                .data(response)
                .build());
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'ROLE_ADMIN')")
    public ResponseEntity<ApiResponse<List<UserResponse>>> getAllUsers() {
        List<UserResponse> list = userService.getAllUsers();
        return ResponseEntity.ok(ApiResponse.<List<UserResponse>>builder()
                .code(1000)
                .message("Lấy danh sách người dùng thành công")
                .data(list)
                .build());
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'ROLE_ADMIN')")
    public ResponseEntity<ApiResponse<UserResponse>> getUserById(@PathVariable Integer id) {
        UserResponse response = userService.getUserById(id);
        return ResponseEntity.ok(ApiResponse.<UserResponse>builder()
                .code(1000)
                .message("Lấy chi tiết người dùng thành công")
                .data(response)
                .build());
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'ROLE_ADMIN')")
    public ResponseEntity<ApiResponse<UserResponse>> createUser(@Valid @RequestBody UserCreationRequest request) {
        UserResponse response = userService.createUser(request);
        return ResponseEntity.ok(ApiResponse.<UserResponse>builder()
                .code(1000)
                .message("Tạo người dùng thành công")
                .data(response)
                .build());
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'ROLE_ADMIN')")
    public ResponseEntity<ApiResponse<UserResponse>> updateUser(
            @PathVariable Integer id,
            @Valid @RequestBody UserUpdateRequest request
    ) {
        UserResponse response = userService.updateUser(id, request);
        return ResponseEntity.ok(ApiResponse.<UserResponse>builder()
                .code(1000)
                .message("Cập nhật người dùng thành công")
                .data(response)
                .build());
    }

    @PutMapping("/{id}/roles")
    @PreAuthorize("hasAnyRole('ADMIN', 'ROLE_ADMIN')")
    public ResponseEntity<ApiResponse<UserResponse>> assignRoles(
            @PathVariable Integer id,
            @RequestBody Set<Integer> roleIds
    ) {
        UserResponse response = userService.assignRoles(id, roleIds);
        return ResponseEntity.ok(ApiResponse.<UserResponse>builder()
                .code(1000)
                .message("Phân vai trò cho người dùng thành công")
                .data(response)
                .build());
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'ROLE_ADMIN')")
    public ResponseEntity<ApiResponse<Void>> deleteUser(@PathVariable Integer id) {
        userService.deleteUser(id);
        return ResponseEntity.ok(ApiResponse.<Void>builder()
                .code(1000)
                .message("Xóa người dùng thành công")
                .build());
    }
}
