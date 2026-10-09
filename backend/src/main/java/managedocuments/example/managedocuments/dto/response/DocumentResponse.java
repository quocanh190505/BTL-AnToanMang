package managedocuments.example.managedocuments.dto.response;



import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

@Getter
@Setter
public class DocumentResponse {
    private Integer id;
    private String title;
    private String description;
    private String fileName;
    private String fileUrl;
    private Boolean isPublic;
    private String ownerUsername;
    private Integer ownerId;
    private String categoryName;
    private Integer categoryId;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
