/**
 * Admin Management Module
 * Handles Users, Roles, and Permissions administration
 */

const Admin = (() => {
  let usersList = [];
  let rolesList = [];
  let permissionsList = [];

  const loadAll = async () => {
    if (!Auth.isAdmin()) return;
    await Promise.all([
      loadUsers(),
      loadRoles(),
      loadPermissions()
    ]);
  };

  // --- USERS MANAGEMENT ---
  const loadUsers = async () => {
    try {
      const res = await API.get('/api/users');
      if (res && res.data) {
        usersList = res.data;
        renderUsersTable();
        const statUsers = document.getElementById('stat-total-users');
        if (statUsers) statUsers.textContent = usersList.length;
      }
    } catch (err) {
      console.error('Failed to load users', err);
    }
  };

  const renderUsersTable = () => {
    const tableBody = document.getElementById('admin-users-table-body');
    if (!tableBody) return;

    if (usersList.length === 0) {
      tableBody.innerHTML = '<tr><td colspan="7" class="text-center py-4 text-muted">Không có người dùng nào</td></tr>';
      return;
    }

    tableBody.innerHTML = usersList.map(u => {
      const rolesArray = Array.from(u.roles || []);
      const roleBadges = rolesArray.map(r => `
        <span class="badge ${r.includes('ADMIN') ? 'bg-danger' : 'bg-primary'} bg-opacity-10 text-${r.includes('ADMIN') ? 'danger' : 'primary'} me-1 mb-1">
          ${escapeHtml(r)}
        </span>
      `).join('');

      return `
        <tr>
          <td class="fw-bold">#${u.id}</td>
          <td>
            <div class="d-flex align-items-center">
              <div class="user-avatar-circle me-2" style="width: 32px; height: 32px; font-size: 0.85rem;">
                ${(u.fullName || u.username || 'U').charAt(0).toUpperCase()}
              </div>
              <div>
                <span class="fw-bold d-block">${escapeHtml(u.username)}</span>
                <small class="text-muted">${escapeHtml(u.fullName || '—')}</small>
              </div>
            </div>
          </td>
          <td>${escapeHtml(u.email || '—')}</td>
          <td>
            <span class="badge ${u.enabled ? 'bg-success' : 'bg-secondary'} bg-opacity-10 text-${u.enabled ? 'success' : 'secondary'}">
              <i class="bi ${u.enabled ? 'bi-check-circle-fill' : 'bi-x-circle-fill'} me-1"></i>
              ${u.enabled ? 'Hoạt động' : 'Vô hiệu hóa'}
            </span>
          </td>
          <td>${roleBadges || '<span class="text-muted small">Chưa có vai trò</span>'}</td>
          <td><small class="text-muted">${u.createdAt ? new Date(u.createdAt).toLocaleDateString('vi-VN') : '—'}</small></td>
          <td class="text-end">
            <div class="btn-group btn-group-sm">
              <button class="btn btn-outline-primary" onclick="Admin.openEditUserModal(${u.id})" title="Chỉnh sửa thông tin">
                <i class="bi bi-pencil"></i>
              </button>
              <button class="btn btn-outline-info" onclick="Admin.openAssignRolesModal(${u.id})" title="Phân vai trò">
                <i class="bi bi-shield-lock"></i>
              </button>
              <button class="btn btn-outline-danger" onclick="Admin.deleteUser(${u.id})" title="Xóa người dùng">
                <i class="bi bi-trash"></i>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  };

  const openCreateUserModal = () => {
    document.getElementById('user-form-id').value = '';
    document.getElementById('user-form-username').value = '';
    document.getElementById('user-form-username').disabled = false;
    document.getElementById('user-form-password').value = '';
    document.getElementById('user-form-password').required = true;
    document.getElementById('user-password-help').textContent = 'Mật khẩu tối thiểu 6 ký tự.';
    document.getElementById('user-form-fullname').value = '';
    document.getElementById('user-form-email').value = '';
    document.getElementById('user-form-enabled').checked = true;

    renderRoleCheckboxes('user-role-checkboxes', []);

    document.getElementById('userModalTitle').innerHTML = '<i class="bi bi-person-plus text-primary me-2"></i> Thêm Người Dùng Mới';
    const modal = new bootstrap.Modal(document.getElementById('userModal'));
    modal.show();
  };

  const openEditUserModal = async (id) => {
    try {
      const res = await API.get(`/api/users/${id}`);
      if (res && res.data) {
        const u = res.data;
        document.getElementById('user-form-id').value = u.id;
        document.getElementById('user-form-username').value = u.username;
        document.getElementById('user-form-username').disabled = true;
        document.getElementById('user-form-password').value = '';
        document.getElementById('user-form-password').required = false;
        document.getElementById('user-password-help').textContent = 'Để trống nếu không muốn đổi mật khẩu.';
        document.getElementById('user-form-fullname').value = u.fullName || '';
        document.getElementById('user-form-email').value = u.email || '';
        document.getElementById('user-form-enabled').checked = Boolean(u.enabled);

        // Pre-select current roles
        const userRoleNames = Array.from(u.roles || []);
        const userRoleIds = rolesList
          .filter(r => userRoleNames.includes(r.name) || userRoleNames.includes(r.name.replace('ROLE_', '')))
          .map(r => r.id);

        renderRoleCheckboxes('user-role-checkboxes', userRoleIds);

        document.getElementById('userModalTitle').innerHTML = '<i class="bi bi-pencil-square text-primary me-2"></i> Chỉnh Sửa Người Dùng';
        const modal = new bootstrap.Modal(document.getElementById('userModal'));
        modal.show();
      }
    } catch (err) {
      API.showToast(err.message, 'error');
    }
  };

  const renderRoleCheckboxes = (containerId, selectedRoleIds = []) => {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (rolesList.length === 0) {
      container.innerHTML = '<span class="text-muted small">Chưa có vai trò nào trong hệ thống.</span>';
      return;
    }

    container.innerHTML = rolesList.map(role => `
      <div class="form-check form-check-inline me-3 mb-2">
        <input class="form-check-input" type="checkbox" name="userRoleIds" value="${role.id}" id="role-cb-${role.id}"
          ${selectedRoleIds.includes(role.id) ? 'checked' : ''}>
        <label class="form-check-label fw-medium" for="role-cb-${role.id}">
          ${escapeHtml(role.name)}
        </label>
      </div>
    `).join('');
  };

  const saveUser = async (e) => {
    if (e) e.preventDefault();

    const id = document.getElementById('user-form-id').value;
    const username = document.getElementById('user-form-username').value.trim();
    const password = document.getElementById('user-form-password').value;
    const fullName = document.getElementById('user-form-fullname').value.trim();
    const email = document.getElementById('user-form-email').value.trim();
    const enabled = document.getElementById('user-form-enabled').checked;

    const selectedRoleInputs = document.querySelectorAll('input[name="userRoleIds"]:checked');
    const roleIds = Array.from(selectedRoleInputs).map(cb => parseInt(cb.value));

    try {
      if (id) {
        // Edit mode (PUT)
        const updateData = { fullName, email, enabled, roleIds };
        if (password) updateData.password = password;

        await API.put(`/api/users/${id}`, updateData);
        API.showToast('Cập nhật người dùng thành công!', 'success');
      } else {
        // Create mode (POST)
        if (!username || !password || !email) {
          API.showToast('Vui lòng điền đầy đủ tên đăng nhập, mật khẩu và email', 'warning');
          return;
        }

        await API.post('/api/users', {
          username,
          password,
          fullName,
          email,
          enabled,
          roleIds
        });
        API.showToast('Tạo người dùng mới thành công!', 'success');
      }

      const modalEl = document.getElementById('userModal');
      const modal = bootstrap.Modal.getInstance(modalEl);
      if (modal) modal.hide();

      await loadUsers();
    } catch (err) {
      API.showToast(err.message, 'error');
    }
  };

  const openAssignRolesModal = async (userId) => {
    try {
      const res = await API.get(`/api/users/${userId}`);
      if (res && res.data) {
        const u = res.data;
        document.getElementById('assign-role-user-id').value = u.id;
        document.getElementById('assign-role-username').textContent = u.username;

        const userRoleNames = Array.from(u.roles || []);
        const userRoleIds = rolesList
          .filter(r => userRoleNames.includes(r.name) || userRoleNames.includes(r.name.replace('ROLE_', '')))
          .map(r => r.id);

        renderRoleCheckboxes('assign-role-checkboxes', userRoleIds);

        const modal = new bootstrap.Modal(document.getElementById('assignRoleModal'));
        modal.show();
      }
    } catch (err) {
      API.showToast(err.message, 'error');
    }
  };

  const saveAssignRoles = async (e) => {
    if (e) e.preventDefault();
    const userId = document.getElementById('assign-role-user-id').value;
    const selectedRoleInputs = document.querySelectorAll('#assign-role-checkboxes input[name="userRoleIds"]:checked');
    const roleIds = Array.from(selectedRoleInputs).map(cb => parseInt(cb.value));

    try {
      await API.put(`/api/users/${userId}/roles`, roleIds);
      API.showToast('Cập nhật vai trò người dùng thành công!', 'success');

      const modalEl = document.getElementById('assignRoleModal');
      const modal = bootstrap.Modal.getInstance(modalEl);
      if (modal) modal.hide();

      await loadUsers();
    } catch (err) {
      API.showToast(err.message, 'error');
    }
  };

  const deleteUser = async (id) => {
    const confirmed = await API.confirmDialog(
      'Xác nhận xóa người dùng',
      'Bạn có chắc chắn muốn xóa tài khoản người dùng này? Mọi dữ liệu liên quan sẽ bị ảnh hưởng.'
    );
    if (!confirmed) return;

    try {
      await API.delete(`/api/users/${id}`);
      API.showToast('Xóa người dùng thành công!', 'success');
      await loadUsers();
    } catch (err) {
      API.showToast(err.message, 'error');
    }
  };

  // --- ROLES MANAGEMENT ---
  const loadRoles = async () => {
    try {
      const res = await API.get('/api/roles');
      if (res && res.data) {
        rolesList = res.data;
        renderRolesCards();
        const statRoles = document.getElementById('stat-total-roles');
        if (statRoles) statRoles.textContent = rolesList.length;
      }
    } catch (err) {
      console.error('Failed to load roles', err);
    }
  };

  const renderRolesCards = () => {
    const container = document.getElementById('admin-roles-container');
    if (!container) return;

    if (rolesList.length === 0) {
      container.innerHTML = '<div class="col-12 text-center py-4 text-muted">Chưa có vai trò nào</div>';
      return;
    }

    container.innerHTML = rolesList.map(role => {
      const permissions = Array.from(role.permissions || []);
      const permBadges = permissions.map(p => `
        <span class="badge bg-light text-dark border me-1 mb-1 font-monospace small">
          <i class="bi bi-key-fill text-warning me-1"></i>${escapeHtml(p)}
        </span>
      `).join('');

      return `
        <div class="col-md-6 col-lg-4 mb-4">
          <div class="card card-custom h-100 p-3">
            <div class="d-flex align-items-center justify-content-between mb-2">
              <span class="badge ${role.name.includes('ADMIN') ? 'bg-danger' : 'bg-primary'} fs-6 px-3 py-2">
                <i class="bi bi-shield-check me-1"></i> ${escapeHtml(role.name)}
              </span>
              <span class="text-muted small">ID: #${role.id}</span>
            </div>
            <p class="text-muted small mt-2 mb-3">
              ${escapeHtml(role.description || 'Chưa có mô tả cho vai trò này.')}
            </p>
            <div class="mb-3">
              <small class="fw-bold text-secondary text-uppercase d-block mb-2">Quyền hạn gán kèm:</small>
              <div class="d-flex flex-wrap" style="max-height: 120px; overflow-y: auto;">
                ${permBadges || '<span class="text-muted small">Chưa có quyền hạn nào được gán</span>'}
              </div>
            </div>
            <div class="mt-auto pt-3 border-top d-flex justify-content-end gap-2">
              <button class="btn btn-sm btn-outline-primary" onclick="Admin.openEditRoleModal(${role.id})">
                <i class="bi bi-pencil me-1"></i> Sửa vai trò
              </button>
              <button class="btn btn-sm btn-outline-danger" onclick="Admin.deleteRole(${role.id})">
                <i class="bi bi-trash me-1"></i> Xóa
              </button>
            </div>
          </div>
        </div>
      `;
    }).join('');
  };

  const openCreateRoleModal = () => {
    document.getElementById('role-form-id').value = '';
    document.getElementById('role-form-name').value = '';
    document.getElementById('role-form-desc').value = '';

    renderPermissionCheckboxes('role-permission-checkboxes', []);

    document.getElementById('roleModalTitle').innerHTML = '<i class="bi bi-shield-plus text-primary me-2"></i> Thêm Vai Trò Mới';
    const modal = new bootstrap.Modal(document.getElementById('roleModal'));
    modal.show();
  };

  const openEditRoleModal = async (id) => {
    try {
      const res = await API.get(`/api/roles/${id}`);
      if (res && res.data) {
        const role = res.data;
        document.getElementById('role-form-id').value = role.id;
        document.getElementById('role-form-name').value = role.name;
        document.getElementById('role-form-desc').value = role.description || '';

        // Pre-select role permissions
        const rolePermNames = Array.from(role.permissions || []);
        const rolePermIds = permissionsList
          .filter(p => rolePermNames.includes(p.name))
          .map(p => p.id);

        renderPermissionCheckboxes('role-permission-checkboxes', rolePermIds);

        document.getElementById('roleModalTitle').innerHTML = '<i class="bi bi-shield-lock text-primary me-2"></i> Chỉnh Sửa Vai Trò';
        const modal = new bootstrap.Modal(document.getElementById('roleModal'));
        modal.show();
      }
    } catch (err) {
      API.showToast(err.message, 'error');
    }
  };

  const renderPermissionCheckboxes = (containerId, selectedPermIds = []) => {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (permissionsList.length === 0) {
      container.innerHTML = '<span class="text-muted small">Chưa có quyền hạn nào được tạo.</span>';
      return;
    }

    container.innerHTML = permissionsList.map(perm => `
      <div class="col-md-6 mb-2">
        <div class="form-check">
          <input class="form-check-input" type="checkbox" name="rolePermissionIds" value="${perm.id}" id="perm-cb-${perm.id}"
            ${selectedPermIds.includes(perm.id) ? 'checked' : ''}>
          <label class="form-check-label" for="perm-cb-${perm.id}">
            <strong class="d-block text-dark">${escapeHtml(perm.name)}</strong>
            <small class="text-muted">${escapeHtml(perm.description || '')}</small>
          </label>
        </div>
      </div>
    `).join('');
  };

  const saveRole = async (e) => {
    if (e) e.preventDefault();
    const id = document.getElementById('role-form-id').value;
    const name = document.getElementById('role-form-name').value.trim();
    const description = document.getElementById('role-form-desc').value.trim();

    if (!name) {
      API.showToast('Vui lòng nhập tên vai trò', 'warning');
      return;
    }

    const selectedPermInputs = document.querySelectorAll('input[name="rolePermissionIds"]:checked');
    const permissionIds = Array.from(selectedPermInputs).map(cb => parseInt(cb.value));

    try {
      if (id) {
        await API.put(`/api/roles/${id}`, { name, description, permissionIds });
        API.showToast('Cập nhật vai trò thành công!', 'success');
      } else {
        await API.post('/api/roles', { name, description, permissionIds });
        API.showToast('Tạo vai trò mới thành công!', 'success');
      }

      const modalEl = document.getElementById('roleModal');
      const modal = bootstrap.Modal.getInstance(modalEl);
      if (modal) modal.hide();

      await loadRoles();
    } catch (err) {
      API.showToast(err.message, 'error');
    }
  };

  const deleteRole = async (id) => {
    const confirmed = await API.confirmDialog(
      'Xác nhận xóa vai trò',
      'Bạn có chắc chắn muốn xóa vai trò này? Thao tác này sẽ gỡ bỏ vai trò khỏi tất cả người dùng liên quan.'
    );
    if (!confirmed) return;

    try {
      await API.delete(`/api/roles/${id}`);
      API.showToast('Xóa vai trò thành công!', 'success');
      await loadRoles();
      await loadUsers();
    } catch (err) {
      API.showToast(err.message, 'error');
    }
  };

  // --- PERMISSIONS MANAGEMENT ---
  const loadPermissions = async () => {
    try {
      const res = await API.get('/api/permissions');
      if (res && res.data) {
        permissionsList = res.data;
        renderPermissionsTable();
      }
    } catch (err) {
      console.error('Failed to load permissions', err);
    }
  };

  const renderPermissionsTable = () => {
    const tableBody = document.getElementById('admin-permissions-table-body');
    if (!tableBody) return;

    if (permissionsList.length === 0) {
      tableBody.innerHTML = '<tr><td colspan="4" class="text-center py-4 text-muted">Chưa có quyền hạn nào</td></tr>';
      return;
    }

    tableBody.innerHTML = permissionsList.map(perm => `
      <tr>
        <td class="fw-bold">#${perm.id}</td>
        <td>
          <span class="badge bg-secondary bg-opacity-10 text-secondary font-monospace fs-6 px-2 py-1">
            <i class="bi bi-key me-1"></i> ${escapeHtml(perm.name)}
          </span>
        </td>
        <td>${escapeHtml(perm.description || '—')}</td>
        <td class="text-end">
          <button class="btn btn-sm btn-outline-danger" onclick="Admin.deletePermission(${perm.id})" title="Xóa quyền hạn">
            <i class="bi bi-trash me-1"></i> Xóa
          </button>
        </td>
      </tr>
    `).join('');
  };

  const openCreatePermissionModal = () => {
    document.getElementById('perm-form-name').value = '';
    document.getElementById('perm-form-desc').value = '';
    const modal = new bootstrap.Modal(document.getElementById('permissionModal'));
    modal.show();
  };

  const savePermission = async (e) => {
    if (e) e.preventDefault();
    const name = document.getElementById('perm-form-name').value.trim();
    const description = document.getElementById('perm-form-desc').value.trim();

    if (!name) {
      API.showToast('Vui lòng nhập tên quyền hạn (Ví dụ: READ_DOCUMENT)', 'warning');
      return;
    }

    try {
      await API.post('/api/permissions', { name, description });
      API.showToast('Tạo quyền hạn mới thành công!', 'success');

      const modalEl = document.getElementById('permissionModal');
      const modal = bootstrap.Modal.getInstance(modalEl);
      if (modal) modal.hide();

      await loadPermissions();
      await loadRoles();
    } catch (err) {
      API.showToast(err.message, 'error');
    }
  };

  const deletePermission = async (id) => {
    const confirmed = await API.confirmDialog(
      'Xác nhận xóa quyền hạn',
      'Bạn có chắc chắn muốn xóa quyền hạn này? Quyền hạn sẽ bị gỡ bỏ khỏi các vai trò hiện tại.'
    );
    if (!confirmed) return;

    try {
      await API.delete(`/api/permissions/${id}`);
      API.showToast('Xóa quyền hạn thành công!', 'success');
      await loadPermissions();
      await loadRoles();
    } catch (err) {
      API.showToast(err.message, 'error');
    }
  };

  return {
    loadAll,
    loadUsers,
    loadRoles,
    loadPermissions,
    openCreateUserModal,
    openEditUserModal,
    openAssignRolesModal,
    saveUser,
    saveAssignRoles,
    deleteUser,
    openCreateRoleModal,
    openEditRoleModal,
    saveRole,
    deleteRole,
    openCreatePermissionModal,
    savePermission,
    deletePermission
  };
})();
