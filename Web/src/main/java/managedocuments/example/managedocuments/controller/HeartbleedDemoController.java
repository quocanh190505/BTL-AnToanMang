package managedocuments.example.managedocuments.controller;

import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.security.SecureRandom;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/heartbleed-demo")
public class HeartbleedDemoController {

    private final SecureRandom random = new SecureRandom();

    @GetMapping("/session")
    public ResponseEntity<Map<String, String>> createSession(
            HttpServletRequest request,
            HttpServletResponse response
    ) {
        HttpSession session = request.getSession(true);

        // Hủy bỏ cookie HEARTBLEED_SESSION nếu trình duyệt còn lưu
        Cookie expireDemoCookie = new Cookie("HEARTBLEED_SESSION", "");
        expireDemoCookie.setPath("/");
        expireDemoCookie.setMaxAge(0);
        response.addCookie(expireDemoCookie);

        Map<String, String> body = new LinkedHashMap<>();
        body.put("message", "Heartbleed demo session created");
        body.put("jsessionid", session.getId());
        return ResponseEntity.ok(body);
    }

    @GetMapping("/ping")
    public ResponseEntity<Map<String, String>> ping(HttpServletRequest request) {
        Map<String, String> body = new LinkedHashMap<>();
        body.put("message", "Cookie-bearing request reached the Spring Boot backend");
        body.put("cookieHeader", request.getHeader("Cookie") == null ? "" : request.getHeader("Cookie"));
        return ResponseEntity.ok(body);
    }

    private String randomHex(int bytes) {
        byte[] data = new byte[bytes];
        random.nextBytes(data);
        return HexFormat.of().formatHex(data);
    }
}
