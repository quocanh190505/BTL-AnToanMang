package managedocuments.example.managedocuments.controller;

import jakarta.validation.Valid;
import managedocuments.example.managedocuments.dto.request.PermissionRequest;
import managedocuments.example.managedocuments.dto.response.ApiResponse;
import managedocuments.example.managedocuments.dto.response.PermissionResponse;
import managedocuments.example.managedocuments.service.PermissionService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/permissions")
@PreAuthorize("hasAnyRole('ADMIN', 'ROLE_ADMIN')")
public class PermissionController {

    private final PermissionService permissionService;

    public PermissionController(PermissionService permissionService) {
        this.permissionService = permissionService;
    }

    @GetMapping
    public ResponseEntity<ApiResponse<List<PermissionResponse>>> getAllPermissions() {
        List<PermissionResponse> list = permissionService.getAllPermissions();
        return ResponseEntity.ok(ApiResponse.<List<PermissionResponse>>builder()
                .code(1000)
                .message("Lấy danh sách quyền hạn thành công")
                .data(list)
                .build());
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<PermissionResponse>> getPermissionById(@PathVariable Integer id) {
        PermissionResponse permission = permissionService.getPermissionById(id);
        return ResponseEntity.ok(ApiResponse.<PermissionResponse>builder()
                .code(1000)
                .message("Lấy thông tin quyền hạn thành công")
                .data(permission)
                .build());
    }

    @PostMapping
    public ResponseEntity<ApiResponse<PermissionResponse>> createPermission(@Valid @RequestBody PermissionRequest request) {
        PermissionResponse permission = permissionService.createPermission(request);
        return ResponseEntity.ok(ApiResponse.<PermissionResponse>builder()
                .code(1000)
                .message("Tạo quyền hạn thành công")
                .data(permission)
                .build());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<ApiResponse<Void>> deletePermission(@PathVariable Integer id) {
        permissionService.deletePermission(id);
        return ResponseEntity.ok(ApiResponse.<Void>builder()
                .code(1000)
                .message("Xóa quyền hạn thành công")
                .build());
    }
}
