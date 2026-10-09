package managedocuments.example.managedocuments.dto.response;

import lombok.Builder;
import lombok.Data;


import java.util.Set;

@Data
@Builder
public class RoleResponse {
    private Integer id;
    private String name;
    private String description;
    private Set<String> permissions; // Chỉ cần trả về list tên quyền
}
