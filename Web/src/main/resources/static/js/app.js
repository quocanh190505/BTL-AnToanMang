/**
 * Main Application Orchestrator & UI Event Handlers
 */

// Utility functions
function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function escapeJs(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r');
}

// Navigation Tab Switcher
function showMainView(viewName) {
  const views = ['documents', 'categories', 'admin'];
  views.forEach(v => {
    const el = document.getElementById(`view-${v}`);
    const navBtn = document.getElementById(`nav-link-${v}`);
    if (el) el.classList.add('d-none');
    if (navBtn) navBtn.classList.remove('active');
  });

  const activeView = document.getElementById(`view-${viewName}`);
  const activeNav = document.getElementById(`nav-link-${viewName}`);
  if (activeView) activeView.classList.remove('d-none');
  if (activeNav) activeNav.classList.add('active');

  // Trigger lazy loading of view specific data
  if (viewName === 'documents') {
    Documents.loadDocuments();
  } else if (viewName === 'categories') {
    Categories.loadCategories();
  } else if (viewName === 'admin') {
    if (!Auth.isAdmin()) {
      API.showToast('Bạn không có quyền truy cập trang quản trị!', 'error');
      showMainView('documents');
      return;
    }
    Admin.loadAll();
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  // Initialize Auth
  await Auth.init();

  // Load Categories for dropdowns
  await Categories.loadCategories();

  // Initial load of documents
  await Documents.loadDocuments();

  // Setup Document Filter Events
  const searchInput = document.getElementById('filter-keyword');
  if (searchInput) {
    let timeout = null;
    searchInput.addEventListener('input', (e) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        Documents.loadDocuments({ keyword: e.target.value.trim(), page: 0 });
      }, 400);
    });
    searchInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        clearTimeout(timeout);
        Documents.loadDocuments({ keyword: e.target.value.trim(), page: 0 });
      }
    });
  }

  const categoryFilter = document.getElementById('filter-category');
  if (categoryFilter) {
    categoryFilter.addEventListener('change', (e) => {
      Documents.loadDocuments({ categoryId: e.target.value, page: 0 });
    });
  }

  const publicFilter = document.getElementById('filter-public');
  if (publicFilter) {
    publicFilter.addEventListener('change', (e) => {
      Documents.loadDocuments({ isPublic: e.target.value, page: 0 });
    });
  }

  const sortFilter = document.getElementById('filter-sort');
  if (sortFilter) {
    sortFilter.addEventListener('change', (e) => {
      Documents.loadDocuments({ sort: e.target.value, page: 0 });
    });
  }

  const pageSizeFilter = document.getElementById('filter-page-size');
  if (pageSizeFilter) {
    pageSizeFilter.addEventListener('change', (e) => {
      Documents.loadDocuments({ size: parseInt(e.target.value), page: 0 });
    });
  }

  // File Drag & Drop in Upload Modal
  const dropzone = document.getElementById('doc-dropzone');
  const fileInput = document.getElementById('doc-file-input');
  const fileLabel = document.getElementById('doc-selected-filename');

  if (dropzone && fileInput) {
    dropzone.addEventListener('click', () => fileInput.click());

    ['dragenter', 'dragover'].forEach(eventName => {
      dropzone.addEventListener(eventName, (e) => {
        e.preventDefault();
        dropzone.classList.add('dragover');
      }, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
      dropzone.addEventListener(eventName, (e) => {
        e.preventDefault();
        dropzone.classList.remove('dragover');
      }, false);
    });

    dropzone.addEventListener('drop', (e) => {
      if (e.dataTransfer.files.length > 0) {
        fileInput.files = e.dataTransfer.files;
        updateSelectedFileInfo();
      }
    });

    fileInput.addEventListener('change', () => {
      updateSelectedFileInfo();
    });

    const updateSelectedFileInfo = () => {
      if (fileInput.files && fileInput.files[0]) {
        const file = fileInput.files[0];
        const sizeMb = (file.size / (1024 * 1024)).toFixed(2);
        fileLabel.innerHTML = `<i class="bi bi-file-earmark-check-fill text-success me-1"></i> <strong>${escapeHtml(file.name)}</strong> (${sizeMb} MB)`;

        // If title is empty, prefill with file name (without extension)
        const titleInput = document.getElementById('doc-form-title');
        if (titleInput && !titleInput.value) {
          const nameWithoutExt = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
          titleInput.value = nameWithoutExt;
        }
      } else {
        fileLabel.textContent = 'Chưa chọn tệp tin';
      }
    };
  }

  // --- FORM SUBMIT LISTENERS ---

  // Login Form
  const loginForm = document.getElementById('login-form');
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const username = document.getElementById('login-username').value.trim();
      const password = document.getElementById('login-password').value;
      const revokeOld = document.getElementById('login-revoke-old').checked;

      const btn = document.getElementById('login-btn');
      const origText = btn.innerHTML;
      btn.disabled = true;
      btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span> Đang xác thực...';

      try {
        await Auth.login(username, password, revokeOld);
        bootstrap.Modal.getInstance(document.getElementById('loginModal')).hide();
        loginForm.reset();
      } catch (err) {
        API.showToast(err.message, 'error');
      } finally {
        btn.disabled = false;
        btn.innerHTML = origText;
      }
    });
  }

  // Register Form
  const registerForm = document.getElementById('register-form');
  if (registerForm) {
    registerForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fullName = document.getElementById('reg-fullname').value.trim();
      const username = document.getElementById('reg-username').value.trim();
      const email = document.getElementById('reg-email').value.trim();
      const password = document.getElementById('reg-password').value;
      const confirmPassword = document.getElementById('reg-confirm-password').value;

      if (password !== confirmPassword) {
        API.showToast('Mật khẩu xác nhận không trùng khớp!', 'warning');
        return;
      }

      const btn = document.getElementById('register-btn');
      const origText = btn.innerHTML;
      btn.disabled = true;
      btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span> Đang tạo tài khoản...';

      try {
        await Auth.register({ username, password, email, fullName });
        bootstrap.Modal.getInstance(document.getElementById('registerModal')).hide();
        registerForm.reset();
      } catch (err) {
        API.showToast(err.message, 'error');
      } finally {
        btn.disabled = false;
        btn.innerHTML = origText;
      }
    });
  }

  // Profile Form (Update Profile)
  const profileForm = document.getElementById('profile-form');
  if (profileForm) {
    profileForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fullName = document.getElementById('profile-fullname').value.trim();
      const email = document.getElementById('profile-email').value.trim();

      try {
        await Auth.updateProfile({ fullName, email });
        bootstrap.Modal.getInstance(document.getElementById('profileModal')).hide();
      } catch (err) {
        API.showToast(err.message, 'error');
      }
    });
  }

  // Change Password Form
  const changePasswordForm = document.getElementById('change-password-form');
  if (changePasswordForm) {
    changePasswordForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const oldPassword = document.getElementById('pwd-old').value;
      const newPassword = document.getElementById('pwd-new').value;
      const confirmPassword = document.getElementById('pwd-confirm').value;

      if (newPassword !== confirmPassword) {
        API.showToast('Mật khẩu mới và xác nhận mật khẩu không khớp!', 'warning');
        return;
      }

      try {
        await Auth.changePassword(oldPassword, newPassword);
        bootstrap.Modal.getInstance(document.getElementById('changePasswordModal')).hide();
        changePasswordForm.reset();
        // Open login modal
        new bootstrap.Modal(document.getElementById('loginModal')).show();
      } catch (err) {
        API.showToast(err.message, 'error');
      }
    });
  }

  // Document Upload/Edit Form
  const docForm = document.getElementById('doc-form');
  if (docForm) {
    docForm.addEventListener('submit', Documents.saveDocument);
  }

  // Category Form
  const categoryForm = document.getElementById('category-form');
  if (categoryForm) {
    categoryForm.addEventListener('submit', Categories.saveCategory);
  }

  // Admin User Form
  const userForm = document.getElementById('user-form');
  if (userForm) {
    userForm.addEventListener('submit', Admin.saveUser);
  }

  // Admin Assign Roles Form
  const assignRoleForm = document.getElementById('assign-role-form');
  if (assignRoleForm) {
    assignRoleForm.addEventListener('submit', Admin.saveAssignRoles);
  }

  // Admin Role Form
  const roleForm = document.getElementById('role-form');
  if (roleForm) {
    roleForm.addEventListener('submit', Admin.saveRole);
  }

  // Admin Permission Form
  const permissionForm = document.getElementById('permission-form');
  if (permissionForm) {
    permissionForm.addEventListener('submit', Admin.savePermission);
  }

  // Global Auth Change Event Handler
  window.addEventListener('auth:changed', (e) => {
    Categories.loadCategories();
    Documents.loadDocuments();
    if (e.detail.loggedIn && Auth.isAdmin()) {
      Admin.loadAll();
    }
  });
});

// Helper to open Profile Modal with current user data
function openProfileModal() {
  const user = Auth.getCurrentUser();
  if (!user) return;

  document.getElementById('profile-username').value = user.username || '';
  document.getElementById('profile-fullname').value = user.fullName || '';
  document.getElementById('profile-email').value = user.email || '';
  document.getElementById('profile-created').value = user.createdAt ? new Date(user.createdAt).toLocaleString('vi-VN') : '—';

  const roles = Array.from(user.roles || []);
  document.getElementById('profile-roles-container').innerHTML = roles.map(r =>
    `<span class="badge ${r.includes('ADMIN') ? 'bg-danger' : 'bg-primary'} me-1">${escapeHtml(r)}</span>`
  ).join('');

  const perms = Array.from(user.permissions || []);
  document.getElementById('profile-perms-container').innerHTML = perms.length > 0
    ? perms.map(p => `<span class="badge bg-light text-dark border me-1 mb-1 font-monospace small">${escapeHtml(p)}</span>`).join('')
    : '<span class="text-muted small">Không có quyền cụ thể</span>';

  const modal = new bootstrap.Modal(document.getElementById('profileModal'));
  modal.show();
}

// Helper to open Session Management Modal
function openSessionsModal() {
  const user = Auth.getCurrentUser();
  if (!user) return;

  document.getElementById('session-user').textContent = user.username;
  const token = API.getAccessToken();
  document.getElementById('session-token-preview').textContent = token ? token.substring(0, 32) + '...' : '—';

  const modal = new bootstrap.Modal(document.getElementById('sessionsModal'));
  modal.show();
}

// Switch between Login and Register Modals
function switchToRegisterModal() {
  bootstrap.Modal.getInstance(document.getElementById('loginModal'))?.hide();
  new bootstrap.Modal(document.getElementById('registerModal')).show();
}

function switchToLoginModal() {
  bootstrap.Modal.getInstance(document.getElementById('registerModal'))?.hide();
  new bootstrap.Modal(document.getElementById('loginModal')).show();
}
