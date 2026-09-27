package managedocuments.example.managedocuments.service;

import managedocuments.example.managedocuments.dto.request.UpdateProfileRequest;
import managedocuments.example.managedocuments.dto.request.UserCreationRequest;
import managedocuments.example.managedocuments.dto.request.UserUpdateRequest;
import managedocuments.example.managedocuments.dto.response.UserResponse;

import java.util.List;
import java.util.Set;

public interface UserService {

    UserResponse getProfile(String username);

    UserResponse updateProfile(String username, UpdateProfileRequest request);

    List<UserResponse> getAllUsers();

    UserResponse getUserById(Integer id);

    UserResponse createUser(UserCreationRequest request);

    UserResponse updateUser(Integer id, UserUpdateRequest request);

    UserResponse assignRoles(Integer userId, Set<Integer> roleIds);

    void deleteUser(Integer id);
}
