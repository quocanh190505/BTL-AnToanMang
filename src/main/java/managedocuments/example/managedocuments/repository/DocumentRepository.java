package managedocuments.example.managedocuments.repository;




import managedocuments.example.managedocuments.entity.Document;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface DocumentRepository extends JpaRepository<Document, Integer>, JpaSpecificationExecutor<Document> {

    // Tìm kiếm cơ bản theo tên
    Page<Document> findByTitleContainingIgnoreCase(String keyword, Pageable pageable);

    // Lọc theo Category
    Page<Document> findByCategoryId(Integer categoryId, Pageable pageable);

    // Lấy danh sách tài liệu của một user cụ thể (kiểm tra ownership)
    List<Document> findByOwnerId(Integer ownerId);

    Page<Document> findByOwnerId(Integer ownerId, Pageable pageable);

    // Lấy danh sách tài liệu công khai
    Page<Document> findByIsPublicTrue(Pageable pageable);
}