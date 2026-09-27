package managedocuments.example.managedocuments.repository;

import managedocuments.example.managedocuments.entity.InvalidatedToken;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.Instant;

@Repository
public interface InvalidatedTokenRepository extends JpaRepository<InvalidatedToken, String> {

    boolean existsById(String id);

    @Modifying
    @Query("DELETE FROM InvalidatedToken it WHERE it.expiryTime < :now")
    void deleteAllExpiredTokens(@Param("now") Instant now);
}
