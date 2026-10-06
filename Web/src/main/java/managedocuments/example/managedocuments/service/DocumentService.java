package managedocuments.example.managedocuments.service;

import managedocuments.example.managedocuments.dto.request.DocumentCreateRequest;
import managedocuments.example.managedocuments.dto.request.DocumentUpdateRequest;
import managedocuments.example.managedocuments.dto.response.DocumentResponse;
import org.springframework.core.io.Resource;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

public interface DocumentService {

    DocumentResponse createDocument(DocumentCreateRequest request, String currentUsername);

    DocumentResponse updateDocument(Integer id, DocumentUpdateRequest request, String currentUsername);

    DocumentResponse getDocumentById(Integer id, String currentUsername);

    void deleteDocument(Integer id, String currentUsername);

    Page<DocumentResponse> getAllDocuments(String keyword, Integer categoryId, Boolean isPublicOnly, Pageable pageable, String currentUsername);

    Page<DocumentResponse> getMyDocuments(Pageable pageable, String currentUsername);

    Resource downloadDocument(Integer id, String currentUsername);
}
