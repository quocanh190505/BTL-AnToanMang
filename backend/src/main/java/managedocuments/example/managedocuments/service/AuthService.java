package managedocuments.example.managedocuments.service;

import managedocuments.example.managedocuments.dto.request.AuthRequest;
import managedocuments.example.managedocuments.dto.request.ChangePasswordRequest;
import managedocuments.example.managedocuments.dto.request.LogoutRequest;
import managedocuments.example.managedocuments.dto.request.RefreshTokenRequest;
import managedocuments.example.managedocuments.dto.request.RegisterRequest;
import managedocuments.example.managedocuments.dto.response.AuthResponse;
import managedocuments.example.managedocuments.dto.response.UserResponse;

public interface AuthService {

    AuthResponse login(AuthRequest request, boolean revokeOldSessions);

    AuthResponse register(RegisterRequest request);

    AuthResponse refreshToken(RefreshTokenRequest request);

    void logout(LogoutRequest request);

    void revokeOldSessions(String username, String currentRefreshToken);

    void revokeAllSessions(String username);

    void changePassword(String username, ChangePasswordRequest request);

    UserResponse getMyInfo(String username);
}
