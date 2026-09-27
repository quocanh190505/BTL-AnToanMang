package managedocuments.example.managedocuments.service.impl;

import managedocuments.example.managedocuments.dto.request.PermissionRequest;
import managedocuments.example.managedocuments.dto.response.PermissionResponse;
import managedocuments.example.managedocuments.entity.Permission;
import managedocuments.example.managedocuments.enums.ErrorCode;
import managedocuments.example.managedocuments.exception.AppException;
import managedocuments.example.managedocuments.mapper.AppMapper;
import managedocuments.example.managedocuments.repository.PermissionRepository;
import managedocuments.example.managedocuments.service.PermissionService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
@Transactional
public class PermissionServiceImpl implements PermissionService {

    private final PermissionRepository permissionRepository;
    private final AppMapper appMapper;

    public PermissionServiceImpl(PermissionRepository permissionRepository, AppMapper appMapper) {
        this.permissionRepository = permissionRepository;
        this.appMapper = appMapper;
    }

    @Override
    @Transactional(readOnly = true)
    public List<PermissionResponse> getAllPermissions() {
        return permissionRepository.findAll().stream()
                .map(appMapper::toPermissionResponse)
                .collect(Collectors.toList());
    }

    @Override
    @Transactional(readOnly = true)
    public PermissionResponse getPermissionById(Integer id) {
        Permission permission = permissionRepository.findById(id)
                .orElseThrow(() -> new AppException(ErrorCode.PERMISSION_NOT_FOUND));
        return appMapper.toPermissionResponse(permission);
    }

    @Override
    public PermissionResponse createPermission(PermissionRequest request) {
        if (permissionRepository.existsByName(request.getName())) {
            throw new AppException(ErrorCode.PERMISSION_EXISTED);
        }

        Permission permission = new Permission();
        permission.setName(request.getName());
        permission.setDescription(request.getDescription());

        Permission saved = permissionRepository.save(permission);
        return appMapper.toPermissionResponse(saved);
    }

    @Override
    public void deletePermission(Integer id) {
        Permission permission = permissionRepository.findById(id)
                .orElseThrow(() -> new AppException(ErrorCode.PERMISSION_NOT_FOUND));
        permissionRepository.delete(permission);
    }
}
