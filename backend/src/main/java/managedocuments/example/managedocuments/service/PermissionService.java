package managedocuments.example.managedocuments.service;

import managedocuments.example.managedocuments.dto.request.PermissionRequest;
import managedocuments.example.managedocuments.dto.response.PermissionResponse;

import java.util.List;

public interface PermissionService {

    List<PermissionResponse> getAllPermissions();

    PermissionResponse getPermissionById(Integer id);

    PermissionResponse createPermission(PermissionRequest request);

    void deletePermission(Integer id);
}
