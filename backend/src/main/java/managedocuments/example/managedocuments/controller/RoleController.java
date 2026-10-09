package managedocuments.example.managedocuments.controller;

import jakarta.validation.Valid;
import managedocuments.example.managedocuments.dto.request.RoleRequest;
import managedocuments.example.managedocuments.dto.response.ApiResponse;
import managedocuments.example.managedocuments.dto.response.RoleResponse;
import managedocuments.example.managedocuments.service.RoleService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/roles")
@PreAuthorize("hasAnyRole('ADMIN', 'ROLE_ADMIN')")
public class RoleController {

    private final RoleService roleService;

    public RoleController(RoleService roleService) {
        this.roleService = roleService;
    }

    @GetMapping
    public ResponseEntity<ApiResponse<List<RoleResponse>>> getAllRoles() {
        List<RoleResponse> list = roleService.getAllRoles();
        return ResponseEntity.ok(ApiResponse.<List<RoleResponse>>builder()
                .code(1000)
                .message("Lấy danh sách vai trò thành công")
                .data(list)
                .build());
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<RoleResponse>> getRoleById(@PathVariable Integer id) {
        RoleResponse role = roleService.getRoleById(id);
        return ResponseEntity.ok(ApiResponse.<RoleResponse>builder()
                .code(1000)
                .message("Lấy thông tin vai trò thành công")
                .data(role)
                .build());
    }

    @PostMapping
    public ResponseEntity<ApiResponse<RoleResponse>> createRole(@Valid @RequestBody RoleRequest request) {
        RoleResponse role = roleService.createRole(request);
        return ResponseEntity.ok(ApiResponse.<RoleResponse>builder()
                .code(1000)
                .message("Tạo vai trò thành công")
                .data(role)
                .build());
    }

    @PutMapping("/{id}")
    public ResponseEntity<ApiResponse<RoleResponse>> updateRole(
            @PathVariable Integer id,
            @Valid @RequestBody RoleRequest request
    ) {
        RoleResponse role = roleService.updateRole(id, request);
        return ResponseEntity.ok(ApiResponse.<RoleResponse>builder()
                .code(1000)
                .message("Cập nhật vai trò thành công")
                .data(role)
                .build());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<ApiResponse<Void>> deleteRole(@PathVariable Integer id) {
        roleService.deleteRole(id);
        return ResponseEntity.ok(ApiResponse.<Void>builder()
                .code(1000)
                .message("Xóa vai trò thành công")
                .build());
    }
}
