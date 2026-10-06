package managedocuments.example.managedocuments.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

@Entity
@Table(name = "invalidated_tokens")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class InvalidatedToken {

    @Id
    private String id; // JWT Token ID (jti) or token string hash

    @Column(name = "expiry_time", nullable = false)
    private Instant expiryTime;
}
