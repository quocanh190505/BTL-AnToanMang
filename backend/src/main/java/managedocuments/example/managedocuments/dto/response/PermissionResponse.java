package managedocuments.example.managedocuments.dto.response;

import lombok.Builder;
import lombok.Data;
import java.util.List;

@Data
@Builder
public class PermissionResponse {
    private Integer id;
    private String name;
    private String description;
}