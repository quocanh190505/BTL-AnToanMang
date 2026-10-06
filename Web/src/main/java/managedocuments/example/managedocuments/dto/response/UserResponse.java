package managedocuments.example.managedocuments.dto.response;



import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;
import java.util.Set;

@Getter
@Setter
public class UserResponse {
    private Integer id;
    private String username;
    private String email;
    private String fullName;
    private Boolean enabled;
    private LocalDateTime createdAt;
    private Set<String> roles;
    private Set <String> permissions;
}