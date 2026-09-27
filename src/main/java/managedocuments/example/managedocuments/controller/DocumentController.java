package managedocuments.example.managedocuments.controller;

import jakarta.validation.Valid;
import managedocuments.example.managedocuments.dto.request.DocumentCreateRequest;
import managedocuments.example.managedocuments.dto.request.DocumentUpdateRequest;
import managedocuments.example.managedocuments.dto.response.ApiResponse;
import managedocuments.example.managedocuments.dto.response.DocumentResponse;
import managedocuments.example.managedocuments.service.DocumentService;
import org.springframework.core.io.Resource;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/documents")
public class DocumentController {

    private final DocumentService documentService;

    public DocumentController(DocumentService documentService) {
        this.documentService = documentService;
    }

    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<ApiResponse<DocumentResponse>> createDocument(
            @ModelAttribute @Valid DocumentCreateRequest request,
            @AuthenticationPrincipal UserDetails userDetails
    ) {
        DocumentResponse response = documentService.createDocument(request, userDetails.getUsername());
        return ResponseEntity.ok(ApiResponse.<DocumentResponse>builder()
                .code(1000)
                .message("Tải lên tài liệu thành công")
                .data(response)
                .build());
    }

    @PutMapping("/{id}")
    public ResponseEntity<ApiResponse<DocumentResponse>> updateDocument(
            @PathVariable Integer id,
            @Valid @RequestBody DocumentUpdateRequest request,
            @AuthenticationPrincipal UserDetails userDetails
    ) {
        DocumentResponse response = documentService.updateDocument(id, request, userDetails.getUsername());
        return ResponseEntity.ok(ApiResponse.<DocumentResponse>builder()
                .code(1000)
                .message("Cập nhật thông tin tài liệu thành công")
                .data(response)
                .build());
    }

    @GetMapping
    public ResponseEntity<ApiResponse<Page<DocumentResponse>>> getAllDocuments(
            @RequestParam(name = "keyword", required = false) String keyword,
            @RequestParam(name = "categoryId", required = false) Integer categoryId,
            @RequestParam(name = "isPublic", required = false) Boolean isPublic,
            @PageableDefault(page = 0, size = 10, sort = "createdAt", direction = Sort.Direction.DESC) Pageable pageable,
            @AuthenticationPrincipal UserDetails userDetails
    ) {
        String username = userDetails != null ? userDetails.getUsername() : null;
        Page<DocumentResponse> page = documentService.getAllDocuments(keyword, categoryId, isPublic, pageable, username);
        return ResponseEntity.ok(ApiResponse.<Page<DocumentResponse>>builder()
                .code(1000)
                .message("Lấy danh sách tài liệu thành công")
                .data(page)
                .build());
    }

    @GetMapping("/my-documents")
    public ResponseEntity<ApiResponse<Page<DocumentResponse>>> getMyDocuments(
            @PageableDefault(page = 0, size = 10, sort = "createdAt", direction = Sort.Direction.DESC) Pageable pageable,
            @AuthenticationPrincipal UserDetails userDetails
    ) {
        Page<DocumentResponse> page = documentService.getMyDocuments(pageable, userDetails.getUsername());
        return ResponseEntity.ok(ApiResponse.<Page<DocumentResponse>>builder()
                .code(1000)
                .message("Lấy danh sách tài liệu cá nhân thành công")
                .data(page)
                .build());
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<DocumentResponse>> getDocumentById(
            @PathVariable Integer id,
            @AuthenticationPrincipal UserDetails userDetails
    ) {
        String username = userDetails != null ? userDetails.getUsername() : null;
        DocumentResponse response = documentService.getDocumentById(id, username);
        return ResponseEntity.ok(ApiResponse.<DocumentResponse>builder()
                .code(1000)
                .message("Lấy chi tiết tài liệu thành công")
                .data(response)
                .build());
    }

    @GetMapping("/{id}/download")
    public ResponseEntity<Resource> downloadDocument(
            @PathVariable Integer id,
            @AuthenticationPrincipal UserDetails userDetails
    ) {
        String username = userDetails != null ? userDetails.getUsername() : null;
        Resource resource = documentService.downloadDocument(id, username);
        DocumentResponse doc = documentService.getDocumentById(id, username);

        return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_OCTET_STREAM)
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + doc.getFileName() + "\"")
                .body(resource);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<ApiResponse<Void>> deleteDocument(
            @PathVariable Integer id,
            @AuthenticationPrincipal UserDetails userDetails
    ) {
        documentService.deleteDocument(id, userDetails.getUsername());
        return ResponseEntity.ok(ApiResponse.<Void>builder()
                .code(1000)
                .message("Xóa tài liệu thành công")
                .build());
    }
}
