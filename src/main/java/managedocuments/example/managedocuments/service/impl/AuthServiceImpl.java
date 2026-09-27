package managedocuments.example.managedocuments.service.impl;

import io.jsonwebtoken.Claims;
import managedocuments.example.managedocuments.configuration.JwtTokenProvider;
import managedocuments.example.managedocuments.dto.request.AuthRequest;
import managedocuments.example.managedocuments.dto.request.ChangePasswordRequest;
import managedocuments.example.managedocuments.dto.request.LogoutRequest;
import managedocuments.example.managedocuments.dto.request.RefreshTokenRequest;
import managedocuments.example.managedocuments.dto.request.RegisterRequest;
import managedocuments.example.managedocuments.dto.response.AuthResponse;
import managedocuments.example.managedocuments.dto.response.UserResponse;
import managedocuments.example.managedocuments.entity.InvalidatedToken;
import managedocuments.example.managedocuments.entity.RefreshToken;
import managedocuments.example.managedocuments.entity.Role;
import managedocuments.example.managedocuments.entity.User;
import managedocuments.example.managedocuments.enums.ErrorCode;
import managedocuments.example.managedocuments.exception.AppException;
import managedocuments.example.managedocuments.mapper.AppMapper;
import managedocuments.example.managedocuments.repository.InvalidatedTokenRepository;
import managedocuments.example.managedocuments.repository.RefreshTokenRepository;
import managedocuments.example.managedocuments.repository.RoleRepository;
import managedocuments.example.managedocuments.repository.UserRepository;
import managedocuments.example.managedocuments.service.AuthService;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Date;
import java.util.HashSet;
import java.util.Optional;
import java.util.Set;

@Service
@Transactional
public class AuthServiceImpl implements AuthService {

    private final UserRepository userRepository;
    private final RoleRepository roleRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final InvalidatedTokenRepository invalidatedTokenRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtTokenProvider jwtTokenProvider;
    private final AppMapper appMapper;

    public AuthServiceImpl(
            UserRepository userRepository,
            RoleRepository roleRepository,
            RefreshTokenRepository refreshTokenRepository,
            InvalidatedTokenRepository invalidatedTokenRepository,
            PasswordEncoder passwordEncoder,
            JwtTokenProvider jwtTokenProvider,
            AppMapper appMapper
    ) {
        this.userRepository = userRepository;
        this.roleRepository = roleRepository;
        this.refreshTokenRepository = refreshTokenRepository;
        this.invalidatedTokenRepository = invalidatedTokenRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtTokenProvider = jwtTokenProvider;
        this.appMapper = appMapper;
    }

    @Override
    public AuthResponse login(AuthRequest request, boolean revokeOldSessions) {
        User user = userRepository.findByUsername(request.getUsername())
                .orElseThrow(() -> new AppException(ErrorCode.UNAUTHENTICATED));

        if (!passwordEncoder.matches(request.getPassword(), user.getPassword())) {
            throw new AppException(ErrorCode.UNAUTHENTICATED);
        }

        if (user.getEnabled() != null && !user.getEnabled()) {
            throw new AppException(ErrorCode.UNAUTHORIZED);
        }

        // Nếu có tùy chọn xóa phiên đăng nhập cũ khi đăng nhập
        if (revokeOldSessions) {
            refreshTokenRepository.deleteAllByUser(user);
        }

        String accessToken = jwtTokenProvider.generateAccessToken(user);
        String refreshToken = jwtTokenProvider.generateRefreshToken(user);

        // Lưu refresh token vào DB
        RefreshToken refreshTokenEntity = RefreshToken.builder()
                .token(refreshToken)
                .user(user)
                .expiryDate(Instant.now().plus(jwtTokenProvider.getRefreshableDuration(), ChronoUnit.SECONDS))
                .revoked(false)
                .build();
        refreshTokenRepository.save(refreshTokenEntity);

        return AuthResponse.builder()
                .token(accessToken)
                .accessToken(accessToken)
                .refreshToken(refreshToken)
                .tokenType("Bearer")
                .expiresIn(jwtTokenProvider.getValidDuration())
                .refreshExpiresIn(jwtTokenProvider.getRefreshableDuration())
                .user(appMapper.toUserResponse(user))
                .build();
    }

    @Override
    public AuthResponse register(RegisterRequest request) {
        if (userRepository.existsByUsername(request.getUsername()) || userRepository.existsByEmail(request.getEmail())) {
            throw new AppException(ErrorCode.USER_EXISTED);
        }

        User user = new User();
        user.setUsername(request.getUsername());
        user.setEmail(request.getEmail());
        user.setFullName(request.getFullName());
        user.setPassword(passwordEncoder.encode(request.getPassword()));
        user.setEnabled(true);

        Set<Role> roles = new HashSet<>();
        Optional<Role> userRoleOpt = roleRepository.findByName("USER");
        if (userRoleOpt.isPresent()) {
            roles.add(userRoleOpt.get());
        } else {
            // Khởi tạo role USER nếu chưa tồn tại
            Role newRole = new Role();
            newRole.setName("USER");
            newRole.setDescription("Người dùng thông thường");
            roles.add(roleRepository.save(newRole));
        }
        user.setRoles(roles);

        User savedUser = userRepository.save(user);

        String accessToken = jwtTokenProvider.generateAccessToken(savedUser);
        String refreshToken = jwtTokenProvider.generateRefreshToken(savedUser);

        RefreshToken refreshTokenEntity = RefreshToken.builder()
                .token(refreshToken)
                .user(savedUser)
                .expiryDate(Instant.now().plus(jwtTokenProvider.getRefreshableDuration(), ChronoUnit.SECONDS))
                .revoked(false)
                .build();
        refreshTokenRepository.save(refreshTokenEntity);

        return AuthResponse.builder()
                .token(accessToken)
                .accessToken(accessToken)
                .refreshToken(refreshToken)
                .tokenType("Bearer")
                .expiresIn(jwtTokenProvider.getValidDuration())
                .refreshExpiresIn(jwtTokenProvider.getRefreshableDuration())
                .user(appMapper.toUserResponse(savedUser))
                .build();
    }

    @Override
    public AuthResponse refreshToken(RefreshTokenRequest request) {
        String token = request.getRefreshToken();
        RefreshToken refreshTokenEntity = refreshTokenRepository.findByToken(token)
                .orElseThrow(() -> new AppException(ErrorCode.REFRESH_TOKEN_NOT_FOUND));

        if (Boolean.TRUE.equals(refreshTokenEntity.getRevoked()) || refreshTokenEntity.getExpiryDate().isBefore(Instant.now())) {
            refreshTokenRepository.delete(refreshTokenEntity);
            throw new AppException(ErrorCode.REFRESH_TOKEN_NOT_FOUND);
        }

        if (!jwtTokenProvider.validateToken(token)) {
            refreshTokenRepository.delete(refreshTokenEntity);
            throw new AppException(ErrorCode.TOKEN_INVALID);
        }

        User user = refreshTokenEntity.getUser();

        // Refresh Token Rotation: Xóa token cũ và cấp token mới
        refreshTokenRepository.delete(refreshTokenEntity);

        String newAccessToken = jwtTokenProvider.generateAccessToken(user);
        String newRefreshToken = jwtTokenProvider.generateRefreshToken(user);

        RefreshToken newRefreshTokenEntity = RefreshToken.builder()
                .token(newRefreshToken)
                .user(user)
                .expiryDate(Instant.now().plus(jwtTokenProvider.getRefreshableDuration(), ChronoUnit.SECONDS))
                .revoked(false)
                .build();
        refreshTokenRepository.save(newRefreshTokenEntity);

        return AuthResponse.builder()
                .token(newAccessToken)
                .accessToken(newAccessToken)
                .refreshToken(newRefreshToken)
                .tokenType("Bearer")
                .expiresIn(jwtTokenProvider.getValidDuration())
                .refreshExpiresIn(jwtTokenProvider.getRefreshableDuration())
                .user(appMapper.toUserResponse(user))
                .build();
    }

    @Override
    public void logout(LogoutRequest request) {
        // Đưa Access Token vào blacklist nếu còn hạn
        if (request.getToken() != null && !request.getToken().isBlank()) {
            try {
                Claims claims = jwtTokenProvider.extractAllClaims(request.getToken());
                String tokenId = claims.getId();
                Date expiration = claims.getExpiration();
                if (tokenId != null && expiration != null && expiration.after(new Date())) {
                    InvalidatedToken invalidatedToken = InvalidatedToken.builder()
                            .id(tokenId)
                            .expiryTime(expiration.toInstant())
                            .build();
                    invalidatedTokenRepository.save(invalidatedToken);
                }
            } catch (Exception ignored) {
                // Token parse failed or already expired
            }
        }

        // Xóa / thu hồi refresh token nếu có
        if (request.getRefreshToken() != null && !request.getRefreshToken().isBlank()) {
            refreshTokenRepository.findByToken(request.getRefreshToken())
                    .ifPresent(refreshTokenRepository::delete);
        }
    }

    @Override
    public void revokeOldSessions(String username, String currentRefreshToken) {
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_FOUND));

        if (currentRefreshToken != null && !currentRefreshToken.isBlank()) {
            refreshTokenRepository.deleteAllByUserExceptCurrent(user, currentRefreshToken);
        } else {
            refreshTokenRepository.deleteAllByUser(user);
        }
    }

    @Override
    public void revokeAllSessions(String username) {
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_FOUND));

        refreshTokenRepository.deleteAllByUser(user);
    }

    @Override
    public void changePassword(String username, ChangePasswordRequest request) {
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_FOUND));

        if (!passwordEncoder.matches(request.getOldPassword(), user.getPassword())) {
            throw new AppException(ErrorCode.OLD_PASSWORD_NOT_MATCH);
        }

        user.setPassword(passwordEncoder.encode(request.getNewPassword()));
        userRepository.save(user);

        // Sau khi đổi mật khẩu, xóa toàn bộ phiên đăng nhập cũ trên các thiết bị để đảm bảo an toàn
        refreshTokenRepository.deleteAllByUser(user);
    }

    @Override
    @Transactional(readOnly = true)
    public UserResponse getMyInfo(String username) {
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_FOUND));

        return appMapper.toUserResponse(user);
    }
}
