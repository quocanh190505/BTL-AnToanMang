package managedocuments.example.managedocuments.mapper;

import managedocuments.example.managedocuments.dto.response.*;
import managedocuments.example.managedocuments.entity.*;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

import java.util.stream.Collectors;

@Mapper(
        componentModel = "spring",
        imports = {Collectors.class, Role.class, Permission.class}
)
public interface AppMapper {

    @Mapping(target = "roles", expression = "java(user.getRoles() != null ? user.getRoles().stream().map(Role::getName).collect(Collectors.toSet()) : java.util.Collections.emptySet())")
    @Mapping(target = "permissions", expression = "java(user.getRoles() != null ? user.getRoles().stream().filter(r -> r.getPermissions() != null).flatMap(role -> role.getPermissions().stream()).map(Permission::getName).collect(Collectors.toSet()) : java.util.Collections.emptySet())")
    UserResponse toUserResponse(User user);

    @Mapping(target = "permissions", expression = "java(role.getPermissions() != null ? role.getPermissions().stream().map(Permission::getName).collect(Collectors.toSet()) : java.util.Collections.emptySet())")
    RoleResponse toRoleResponse(Role role);

    PermissionResponse toPermissionResponse(Permission permission);

    CategoryResponse toCategoryResponse(Category category);

    @Mapping(source = "owner.id", target = "ownerId")
    @Mapping(source = "owner.username", target = "ownerUsername")
    @Mapping(source = "category.id", target = "categoryId")
    @Mapping(source = "category.name", target = "categoryName")
    DocumentResponse toDocumentResponse(Document document);
}
