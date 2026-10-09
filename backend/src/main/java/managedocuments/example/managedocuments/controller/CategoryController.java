package managedocuments.example.managedocuments.controller;

import jakarta.validation.Valid;
import managedocuments.example.managedocuments.dto.request.CategoryRequest;
import managedocuments.example.managedocuments.dto.response.ApiResponse;
import managedocuments.example.managedocuments.dto.response.CategoryResponse;
import managedocuments.example.managedocuments.service.CategoryService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/categories")
public class CategoryController {

    private final CategoryService categoryService;

    public CategoryController(CategoryService categoryService) {
        this.categoryService = categoryService;
    }

    @GetMapping
    public ResponseEntity<ApiResponse<List<CategoryResponse>>> getAllCategories() {
        List<CategoryResponse> list = categoryService.getAllCategories();
        return ResponseEntity.ok(ApiResponse.<List<CategoryResponse>>builder()
                .code(1000)
                .message("Lấy danh sách danh mục thành công")
                .data(list)
                .build());
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<CategoryResponse>> getCategoryById(@PathVariable Integer id) {
        CategoryResponse category = categoryService.getCategoryById(id);
        return ResponseEntity.ok(ApiResponse.<CategoryResponse>builder()
                .code(1000)
                .message("Lấy thông tin danh mục thành công")
                .data(category)
                .build());
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'ROLE_ADMIN')")
    public ResponseEntity<ApiResponse<CategoryResponse>> createCategory(@Valid @RequestBody CategoryRequest request) {
        CategoryResponse category = categoryService.createCategory(request);
        return ResponseEntity.ok(ApiResponse.<CategoryResponse>builder()
                .code(1000)
                .message("Tạo danh mục thành công")
                .data(category)
                .build());
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'ROLE_ADMIN')")
    public ResponseEntity<ApiResponse<CategoryResponse>> updateCategory(
            @PathVariable Integer id,
            @Valid @RequestBody CategoryRequest request
    ) {
        CategoryResponse category = categoryService.updateCategory(id, request);
        return ResponseEntity.ok(ApiResponse.<CategoryResponse>builder()
                .code(1000)
                .message("Cập nhật danh mục thành công")
                .data(category)
                .build());
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'ROLE_ADMIN')")
    public ResponseEntity<ApiResponse<Void>> deleteCategory(@PathVariable Integer id) {
        categoryService.deleteCategory(id);
        return ResponseEntity.ok(ApiResponse.<Void>builder()
                .code(1000)
                .message("Xóa danh mục thành công")
                .build());
    }
}
