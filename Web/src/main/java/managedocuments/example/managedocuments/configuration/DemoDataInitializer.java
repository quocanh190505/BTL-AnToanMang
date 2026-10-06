package managedocuments.example.managedocuments.configuration;

import managedocuments.example.managedocuments.entity.Role;
import managedocuments.example.managedocuments.entity.User;
import managedocuments.example.managedocuments.repository.RoleRepository;
import managedocuments.example.managedocuments.repository.UserRepository;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.Set;

@Component
public class DemoDataInitializer implements CommandLineRunner {

    private final UserRepository userRepository;
    private final RoleRepository roleRepository;
    private final PasswordEncoder passwordEncoder;

    public DemoDataInitializer(
            UserRepository userRepository,
            RoleRepository roleRepository,
            PasswordEncoder passwordEncoder
    ) {
        this.userRepository = userRepository;
        this.roleRepository = roleRepository;
        this.passwordEncoder = passwordEncoder;
    }

    @Override
    @Transactional
    public void run(String... args) {
        Role userRole = roleRepository.findByName("USER").orElseGet(() -> createRole("USER", "Demo user"));
        Role adminRole = roleRepository.findByName("ADMIN").orElseGet(() -> createRole("ADMIN", "Demo administrator"));

        if (!userRepository.existsByUsername("demo")) {
            User demo = new User();
            demo.setUsername("demo");
            demo.setEmail("demo@heartbleed.local");
            demo.setFullName("Heartbleed Demo User");
            demo.setPassword(passwordEncoder.encode("demo123"));
            demo.setEnabled(true);
            demo.setRoles(Set.of(userRole, adminRole));
            userRepository.save(demo);
        }
    }

    private Role createRole(String name, String description) {
        Role role = new Role();
        role.setName(name);
        role.setDescription(description);
        return roleRepository.save(role);
    }
}
