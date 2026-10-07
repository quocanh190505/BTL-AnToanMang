package managedocuments.example.managedocuments.configuration;

import managedocuments.example.managedocuments.entity.Category;
import managedocuments.example.managedocuments.entity.Permission;
import managedocuments.example.managedocuments.entity.Role;
import managedocuments.example.managedocuments.entity.User;
import managedocuments.example.managedocuments.repository.CategoryRepository;
import managedocuments.example.managedocuments.repository.PermissionRepository;
import managedocuments.example.managedocuments.repository.RoleRepository;
import managedocuments.example.managedocuments.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;

@Component
public class DataInitializer implements CommandLineRunner {

    private static final Logger log = LoggerFactory.getLogger(DataInitializer.class);

    private final CategoryRepository categoryRepository;
    private final RoleRepository roleRepository;
    private final PermissionRepository permissionRepository;
    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    public DataInitializer(
            CategoryRepository categoryRepository,
            RoleRepository roleRepository,
            PermissionRepository permissionRepository,
            UserRepository userRepository,
            PasswordEncoder passwordEncoder
    ) {
        this.categoryRepository = categoryRepository;
        this.roleRepository = roleRepository;
        this.permissionRepository = permissionRepository;
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
    }

    @Override
    @Transactional
    public void run(String... args) {
        initCategories();
        initRolesAndPermissions();
        initDefaultAdmin();
    }

    private void initCategories() {
        if (categoryRepository.count() == 0) {
            log.info("Seeding default categories into database...");
            List<Category> categories = List.of(
                    createCategory("Tài liệu học tập", "Giáo trình, bài giảng, slide và tài liệu học tập chung"),
                    createCategory("Báo cáo nghiên cứu", "Báo cáo chuyên đề, đề tài nghiên cứu khoa học"),
                    createCategory("An toàn thông tin", "Tài liệu kỹ thuật an toàn mạng, bảo mật và mật mã học"),
                    createCategory("Công nghệ thông tin", "Tài liệu lập trình, kiến trúc hệ thống và cơ sở dữ liệu"),
                    createCategory("Tài liệu kỹ thuật", "Tài liệu hướng dẫn kỹ thuật, spec hệ thống"),
                    createCategory("Khác", "Tài liệu tổng hợp và các nội dung khác")
            );
            categoryRepository.saveAll(categories);
            log.info("Default categories seeded successfully!");
        }
    }

    private Category createCategory(String name, String description) {
        Category cat = new Category();
        cat.setName(name);
        cat.setDescription(description);
        return cat;
    }

    private void initRolesAndPermissions() {
        if (permissionRepository.count() == 0) {
            log.info("Seeding default permissions...");
            List<Permission> permissions = List.of(
                    createPermission("READ_DOCUMENT", "Quyền xem và tải tài liệu"),
                    createPermission("CREATE_DOCUMENT", "Quyền tải lên tài liệu mới"),
                    createPermission("UPDATE_DOCUMENT", "Quyền chỉnh sửa thông tin tài liệu"),
                    createPermission("DELETE_DOCUMENT", "Quyền xóa tài liệu"),
                    createPermission("MANAGE_USERS", "Quyền quản trị người dùng"),
                    createPermission("MANAGE_ROLES", "Quyền quản trị vai trò"),
                    createPermission("MANAGE_CATEGORIES", "Quyền quản trị danh mục tài liệu")
            );
            permissionRepository.saveAll(permissions);
        }

        // Initialize ADMIN role
        Optional<Role> adminRoleOpt = roleRepository.findByName("ADMIN");
        if (adminRoleOpt.isEmpty()) {
            Role adminRole = new Role();
            adminRole.setName("ADMIN");
            adminRole.setDescription("Quản trị viên toàn hệ thống");
            adminRole.setPermissions(new HashSet<>(permissionRepository.findAll()));
            roleRepository.save(adminRole);
        }

        // Initialize USER role
        Optional<Role> userRoleOpt = roleRepository.findByName("USER");
        if (userRoleOpt.isEmpty()) {
            Role userRole = new Role();
            userRole.setName("USER");
            userRole.setDescription("Người dùng thông thường");
            userRole.setPermissions(new HashSet<>());
            roleRepository.save(userRole);
        }
    }

    private Permission createPermission(String name, String description) {
        Permission p = new Permission();
        p.setName(name);
        p.setDescription(description);
        return p;
    }

    private void initDefaultAdmin() {
        if (!userRepository.existsByUsername("admin")) {
            Role adminRole = roleRepository.findByName("ADMIN").orElse(null);
            Role userRole = roleRepository.findByName("USER").orElse(null);

            User admin = new User();
            admin.setUsername("admin");
            admin.setPassword(passwordEncoder.encode("Password@123"));
            admin.setEmail("admin@docsafe.local");
            admin.setFullName("Quản Trị Viên");
            admin.setEnabled(true);

            Set<Role> roles = new HashSet<>();
            if (adminRole != null) roles.add(adminRole);
            if (userRole != null) roles.add(userRole);
            admin.setRoles(roles);

            userRepository.save(admin);
            log.info("Default admin user created: admin / Password@123");
        }
    }
}
