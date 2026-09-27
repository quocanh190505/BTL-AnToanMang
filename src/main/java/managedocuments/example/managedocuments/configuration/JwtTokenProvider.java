package managedocuments.example.managedocuments.configuration;

import io.jsonwebtoken.*;
import io.jsonwebtoken.io.Decoders;
import io.jsonwebtoken.security.Keys;
import managedocuments.example.managedocuments.entity.Permission;
import managedocuments.example.managedocuments.entity.Role;
import managedocuments.example.managedocuments.entity.User;
import managedocuments.example.managedocuments.repository.InvalidatedTokenRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.stream.Collectors;

@Component
public class JwtTokenProvider {

    @Value("${jwt.signer-key:1234567890123456789012345678901234567890123456789012345678901234}")
    private String signerKey;

    @Value("${jwt.valid-duration:3600}") // default 1 hour in seconds
    private long validDuration;

    @Value("${jwt.refreshable-duration:604800}") // default 7 days in seconds
    private long refreshableDuration;

    private final InvalidatedTokenRepository invalidatedTokenRepository;

    public JwtTokenProvider(InvalidatedTokenRepository invalidatedTokenRepository) {
        this.invalidatedTokenRepository = invalidatedTokenRepository;
    }

    private SecretKey getSigningKey() {
        byte[] keyBytes = signerKey.getBytes();
        if (keyBytes.length < 32) {
            // pad or hash if needed
            return Keys.hmacShaKeyFor(Arrays.copyOf(keyBytes, 32));
        }
        return Keys.hmacShaKeyFor(keyBytes);
    }

    public String generateAccessToken(User user) {
        Instant now = Instant.now();
        Instant expiry = now.plus(validDuration, ChronoUnit.SECONDS);

        Set<String> roles = user.getRoles() != null
                ? user.getRoles().stream().map(Role::getName).collect(Collectors.toSet())
                : Collections.emptySet();

        Set<String> permissions = user.getRoles() != null
                ? user.getRoles().stream()
                .filter(r -> r.getPermissions() != null)
                .flatMap(r -> r.getPermissions().stream())
                .map(Permission::getName)
                .collect(Collectors.toSet())
                : Collections.emptySet();

        return Jwts.builder()
                .id(UUID.randomUUID().toString())
                .subject(user.getUsername())
                .issuer("managedocuments.example")
                .issuedAt(Date.from(now))
                .expiration(Date.from(expiry))
                .claim("userId", user.getId())
                .claim("roles", roles)
                .claim("permissions", permissions)
                .claim("tokenType", "ACCESS")
                .signWith(getSigningKey(), Jwts.SIG.HS256)
                .compact();
    }

    public String generateRefreshToken(User user) {
        Instant now = Instant.now();
        Instant expiry = now.plus(refreshableDuration, ChronoUnit.SECONDS);

        return Jwts.builder()
                .id(UUID.randomUUID().toString())
                .subject(user.getUsername())
                .issuer("managedocuments.example")
                .issuedAt(Date.from(now))
                .expiration(Date.from(expiry))
                .claim("userId", user.getId())
                .claim("tokenType", "REFRESH")
                .signWith(getSigningKey(), Jwts.SIG.HS256)
                .compact();
    }

    public Claims extractAllClaims(String token) {
        return Jwts.parser()
                .verifyWith(getSigningKey())
                .build()
                .parseSignedClaims(token)
                .getPayload();
    }

    public String extractUsername(String token) {
        return extractAllClaims(token).getSubject();
    }

    public String extractTokenId(String token) {
        return extractAllClaims(token).getId();
    }

    public Date extractExpiration(String token) {
        return extractAllClaims(token).getExpiration();
    }

    public boolean validateToken(String token) {
        try {
            Claims claims = extractAllClaims(token);
            String tokenId = claims.getId();
            if (tokenId != null && invalidatedTokenRepository.existsById(tokenId)) {
                return false;
            }
            return !claims.getExpiration().before(new Date());
        } catch (JwtException | IllegalArgumentException e) {
            return false;
        }
    }

    public long getValidDuration() {
        return validDuration;
    }

    public long getRefreshableDuration() {
        return refreshableDuration;
    }
}
