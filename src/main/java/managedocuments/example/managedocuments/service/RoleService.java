package managedocuments.example.managedocuments.service;

import managedocuments.example.managedocuments.dto.request.RoleRequest;
import managedocuments.example.managedocuments.dto.response.RoleResponse;

import java.util.List;

public interface RoleService {

    List<RoleResponse> getAllRoles();

    RoleResponse getRoleById(Integer id);

    RoleResponse createRole(RoleRequest request);

    RoleResponse updateRole(Integer id, RoleRequest request);

    void deleteRole(Integer id);
}
