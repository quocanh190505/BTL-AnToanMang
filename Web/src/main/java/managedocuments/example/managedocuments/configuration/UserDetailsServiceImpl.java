package managedocuments.example.managedocuments.configuration;

import managedocuments.example.managedocuments.entity.Permission;
import managedocuments.example.managedocuments.entity.Role;
import managedocuments.example.managedocuments.entity.User;
import managedocuments.example.managedocuments.repository.UserRepository;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashSet;
import java.util.Set;

@Service
public class UserDetailsServiceImpl implements UserDetailsService {

    private final UserRepository userRepository;

    public UserDetailsServiceImpl(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    @Override
    @Transactional(readOnly = true)
    public UserDetails loadUserByUsername(String username) throws UsernameNotFoundException {
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new UsernameNotFoundException("Không tìm thấy người dùng với username: " + username));

        Set<GrantedAuthority> authorities = new HashSet<>();

        if (user.getRoles() != null) {
            for (Role role : user.getRoles()) {
                // Role authority: ROLE_ADMIN, ROLE_USER...
                String roleName = role.getName().startsWith("ROLE_") ? role.getName() : "ROLE_" + role.getName();
                authorities.add(new SimpleGrantedAuthority(roleName));

                // Permission authorities: READ_DOCUMENT, WRITE_DOCUMENT...
                if (role.getPermissions() != null) {
                    for (Permission perm : role.getPermissions()) {
                        authorities.add(new SimpleGrantedAuthority(perm.getName()));
                    }
                }
            }
        }

        return new org.springframework.security.core.userdetails.User(
                user.getUsername(),
                user.getPassword(),
                user.getEnabled() != null && user.getEnabled(),
                true,
                true,
                true,
                authorities
        );
    }
}
