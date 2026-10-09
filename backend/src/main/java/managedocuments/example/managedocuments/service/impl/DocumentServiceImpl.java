package managedocuments.example.managedocuments.service.impl;

import jakarta.persistence.criteria.Predicate;
import managedocuments.example.managedocuments.dto.request.DocumentCreateRequest;
import managedocuments.example.managedocuments.dto.request.DocumentUpdateRequest;
import managedocuments.example.managedocuments.dto.response.DocumentResponse;
import managedocuments.example.managedocuments.entity.Category;
import managedocuments.example.managedocuments.entity.Document;
import managedocuments.example.managedocuments.entity.Role;
import managedocuments.example.managedocuments.entity.User;
import managedocuments.example.managedocuments.enums.ErrorCode;
import managedocuments.example.managedocuments.exception.AppException;
import managedocuments.example.managedocuments.mapper.AppMapper;
import managedocuments.example.managedocuments.repository.CategoryRepository;
import managedocuments.example.managedocuments.repository.DocumentRepository;
import managedocuments.example.managedocuments.repository.UserRepository;
import managedocuments.example.managedocuments.service.DocumentService;
import managedocuments.example.managedocuments.service.FileStorageService;
import org.springframework.core.io.Resource;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.util.ArrayList;
import java.util.List;

@Service
@Transactional
public class DocumentServiceImpl implements DocumentService {

    private final DocumentRepository documentRepository;
    private final CategoryRepository categoryRepository;
    private final UserRepository userRepository;
    private final FileStorageService fileStorageService;
    private final AppMapper appMapper;

    public DocumentServiceImpl(
            DocumentRepository documentRepository,
            CategoryRepository categoryRepository,
            UserRepository userRepository,
            FileStorageService fileStorageService,
            AppMapper appMapper
    ) {
        this.documentRepository = documentRepository;
        this.categoryRepository = categoryRepository;
        this.userRepository = userRepository;
        this.fileStorageService = fileStorageService;
        this.appMapper = appMapper;
    }

    private boolean isUserAdmin(User user) {
        if (user == null || user.getRoles() == null) return false;
        return user.getRoles().stream()
                .anyMatch(r -> "ADMIN".equalsIgnoreCase(r.getName()) || "ROLE_ADMIN".equalsIgnoreCase(r.getName()));
    }

    @Override
    public DocumentResponse createDocument(DocumentCreateRequest request, String currentUsername) {
        User owner = userRepository.findByUsername(currentUsername)
                .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_FOUND));

        Category category = categoryRepository.findById(request.getCategoryId())
                .orElseThrow(() -> new AppException(ErrorCode.CATEGORY_NOT_FOUND));

        String storedFileName = fileStorageService.storeFile(request.getFile());
        String originalFileName = request.getFile().getOriginalFilename();

        Document document = new Document();
        document.setTitle(request.getTitle());
        document.setDescription(request.getDescription());
        document.setFileName(originalFileName);
        document.setFileUrl(storedFileName);
        document.setOwner(owner);
        document.setCategory(category);
        document.setIsPublic(request.getIsPublic() != null ? request.getIsPublic() : false);

        Document saved = documentRepository.save(document);
        return appMapper.toDocumentResponse(saved);
    }

    @Override
    public DocumentResponse updateDocument(Integer id, DocumentUpdateRequest request, String currentUsername) {
        Document document = documentRepository.findById(id)
                .orElseThrow(() -> new AppException(ErrorCode.DOCUMENT_NOT_FOUND));

        User currentUser = userRepository.findByUsername(currentUsername)
                .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_FOUND));

        // Kiểm tra quyền sở hữu hoặc role admin
        if (!document.getOwner().getId().equals(currentUser.getId()) && !isUserAdmin(currentUser)) {
            throw new AppException(ErrorCode.UNAUTHORIZED);
        }

        Category category = categoryRepository.findById(request.getCategoryId())
                .orElseThrow(() -> new AppException(ErrorCode.CATEGORY_NOT_FOUND));

        document.setTitle(request.getTitle());
        document.setDescription(request.getDescription());
        document.setCategory(category);
        if (request.getIsPublic() != null) {
            document.setIsPublic(request.getIsPublic());
        }

        Document saved = documentRepository.save(document);
        return appMapper.toDocumentResponse(saved);
    }

    @Override
    @Transactional(readOnly = true)
    public DocumentResponse getDocumentById(Integer id, String currentUsername) {
        Document document = documentRepository.findById(id)
                .orElseThrow(() -> new AppException(ErrorCode.DOCUMENT_NOT_FOUND));

        if (Boolean.FALSE.equals(document.getIsPublic())) {
            if (currentUsername == null) {
                throw new AppException(ErrorCode.UNAUTHORIZED);
            }
            User currentUser = userRepository.findByUsername(currentUsername)
                    .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_FOUND));

            if (!document.getOwner().getId().equals(currentUser.getId()) && !isUserAdmin(currentUser)) {
                throw new AppException(ErrorCode.UNAUTHORIZED);
            }
        }

        return appMapper.toDocumentResponse(document);
    }

    @Override
    public void deleteDocument(Integer id, String currentUsername) {
        Document document = documentRepository.findById(id)
                .orElseThrow(() -> new AppException(ErrorCode.DOCUMENT_NOT_FOUND));

        User currentUser = userRepository.findByUsername(currentUsername)
                .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_FOUND));

        if (!document.getOwner().getId().equals(currentUser.getId()) && !isUserAdmin(currentUser)) {
            throw new AppException(ErrorCode.UNAUTHORIZED);
        }

        fileStorageService.deleteFile(document.getFileUrl());
        documentRepository.delete(document);
    }

    @Override
    @Transactional(readOnly = true)
    public Page<DocumentResponse> getAllDocuments(
            String keyword,
            Integer categoryId,
            Boolean isPublicOnly,
            Pageable pageable,
            String currentUsername
    ) {
        User currentUser = null;
        if (StringUtils.hasText(currentUsername)) {
            currentUser = userRepository.findByUsername(currentUsername).orElse(null);
        }

        final User finalUser = currentUser;
        final boolean isAdmin = isUserAdmin(currentUser);

        Specification<Document> spec = (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();

            if (StringUtils.hasText(keyword)) {
                predicates.add(cb.like(cb.lower(root.get("title")), "%" + keyword.toLowerCase() + "%"));
            }

            if (categoryId != null) {
                predicates.add(cb.equal(root.get("category").get("id"), categoryId));
            }

            if (Boolean.TRUE.equals(isPublicOnly)) {
                predicates.add(cb.isTrue(root.get("isPublic")));
            } else {
                // Nếu không lọc chỉ public:
                // Nếu chưa đăng nhập: chỉ xem public
                if (finalUser == null) {
                    predicates.add(cb.isTrue(root.get("isPublic")));
                } else if (!isAdmin) {
                    // Nếu user thường: xem public HOẶC tài liệu của chính mình
                    Predicate isPublic = cb.isTrue(root.get("isPublic"));
                    Predicate isOwner = cb.equal(root.get("owner").get("id"), finalUser.getId());
                    predicates.add(cb.or(isPublic, isOwner));
                }
                // Nếu là ADMIN: xem tất cả
            }

            return cb.and(predicates.toArray(new Predicate[0]));
        };

        return documentRepository.findAll(spec, pageable).map(appMapper::toDocumentResponse);
    }

    @Override
    @Transactional(readOnly = true)
    public Page<DocumentResponse> getMyDocuments(Pageable pageable, String currentUsername) {
        User currentUser = userRepository.findByUsername(currentUsername)
                .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_FOUND));

        return documentRepository.findByOwnerId(currentUser.getId(), pageable)
                .map(appMapper::toDocumentResponse);
    }

    @Override
    @Transactional(readOnly = true)
    public Resource downloadDocument(Integer id, String currentUsername) {
        Document document = documentRepository.findById(id)
                .orElseThrow(() -> new AppException(ErrorCode.DOCUMENT_NOT_FOUND));

        if (Boolean.FALSE.equals(document.getIsPublic())) {
            if (currentUsername == null) {
                throw new AppException(ErrorCode.UNAUTHORIZED);
            }
            User currentUser = userRepository.findByUsername(currentUsername)
                    .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_FOUND));

            if (!document.getOwner().getId().equals(currentUser.getId()) && !isUserAdmin(currentUser)) {
                throw new AppException(ErrorCode.UNAUTHORIZED);
            }
        }

        return fileStorageService.loadFileAsResource(document.getFileUrl());
    }
}
