package managedocuments.example.managedocuments.dto.request;


import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.Setter;
import org.springframework.web.multipart.MultipartFile;

@Getter
@Setter
public class DocumentCreateRequest {

    @NotBlank(message = "Tiêu đề tài liệu không được để trống")
    private String title;

    private String description;

    @NotNull(message = "Category ID không được để trống")
    private Integer categoryId;

    private Boolean isPublic = false;

    @NotNull(message = "File tải lên không được để trống")
    private MultipartFile file;
}