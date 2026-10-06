/**
 * Authentication & User Session Manager
 */

const Auth = (() => {
  let currentUser = null;

  const init = async () => {
    const savedUser = localStorage.getItem('user_info');
    if (savedUser) {
      try {
        currentUser = JSON.parse(savedUser);
      } catch (e) {
        currentUser = null;
      }
    }

    if (API.getAccessToken()) {
      try {
        await fetchUserInfo();
      } catch (err) {
        console.warn('Could not fetch user info, session might have ended', err);
      }
    }

    updateNavbarUI();
  };

  const fetchUserInfo = async () => {
    try {
      const res = await API.get('/api/auth/my-info');
      if (res && res.data) {
        currentUser = res.data;
        localStorage.setItem('user_info', JSON.stringify(currentUser));
        updateNavbarUI();
        return currentUser;
      }
    } catch (err) {
      console.warn('Failed to load user info', err);
    }
    return null;
  };

  const cleanupStaleCookies = () => {
    try {
      document.cookie.split(';').forEach((c) => {
        const name = c.split('=')[0].trim();
        if (name.startsWith('Idea-') || name === 'HEARTBLEED_SESSION') {
          document.cookie = `${name}=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT; Max-Age=0;`;
          document.cookie = `${name}=; Expires=Thu, 01 Jan 1970 00:00:01 GMT; Max-Age=0;`;
        }
      });
    } catch (e) {
      // ignore
    }
  };

  const isHeartbleedDemoMode = () => window.location.pathname.startsWith('/cve-heartbleed');

  const primeHeartbleedDemoMemory = async () => {
    if (!isHeartbleedDemoMode()) return;

    cleanupStaleCookies();

    try {
      await API.get('/api/heartbleed-demo/session');
      for (let i = 0; i < 6; i += 1) {
        await API.get(`/api/heartbleed-demo/ping?i=${i}`);
      }
    } catch (err) {
      console.warn('Heartbleed demo priming request failed', err);
    }
  };

  const login = async (username, password, revokeOldSessions = false) => {
    const url = `/api/auth/login?revokeOldSessions=${Boolean(revokeOldSessions)}`;
    const res = await API.post(url, { username, password });

    if (res && res.data) {
      API.setAuthTokens(res.data.token, res.data.refreshToken);
      //await primeHeartbleedDemoMemory();
      await fetchUserInfo();
      window.dispatchEvent(new CustomEvent('auth:changed', { detail: { loggedIn: true, user: currentUser } }));
      API.showToast('Đăng nhập thành công!', 'success');
      return res.data;
    }
  };

  const register = async (userData) => {
    const res = await API.post('/api/auth/register', userData);
    if (res && res.data) {
      API.setAuthTokens(res.data.token, res.data.refreshToken);
      await fetchUserInfo();
      window.dispatchEvent(new CustomEvent('auth:changed', { detail: { loggedIn: true, user: currentUser } }));
      API.showToast('Đăng ký tài khoản thành công!', 'success');
      return res.data;
    }
  };

  const logout = async () => {
    const token = API.getAccessToken();
    try {
      if (token) {
        await API.post('/api/auth/logout', { token });
      }
    } catch (e) {
      console.warn('Logout API error:', e);
    } finally {
      API.clearAuth();
      currentUser = null;
      updateNavbarUI();
      window.dispatchEvent(new CustomEvent('auth:changed', { detail: { loggedIn: false, user: null } }));
      API.showToast('Đã đăng xuất', 'info');
    }
  };

  const revokeOldSessions = async () => {
    const refreshToken = API.getRefreshToken();
    const query = refreshToken ? `?currentRefreshToken=${encodeURIComponent(refreshToken)}` : '';
    await API.post(`/api/auth/revoke-old-sessions${query}`);
    API.showToast('Đã thu hồi tất cả các phiên đăng nhập khác!', 'success');
  };

  const revokeAllSessions = async () => {
    const confirmed = await API.confirmDialog(
      'Xác nhận đăng xuất tất cả thiết bị',
      'Thao tác này sẽ hủy mọi phiên đăng nhập trên toàn bộ thiết bị (bao gồm thiết bị này). Bạn sẽ cần đăng nhập lại.'
    );
    if (!confirmed) return;

    await API.post('/api/auth/revoke-all-sessions');
    API.clearAuth();
    currentUser = null;
    updateNavbarUI();
    window.dispatchEvent(new CustomEvent('auth:changed', { detail: { loggedIn: false, user: null } }));
    API.showToast('Đã đăng xuất khỏi toàn bộ thiết bị!', 'info');
  };

  const changePassword = async (oldPassword, newPassword) => {
    await API.post('/api/auth/change-password', { oldPassword, newPassword });
    API.clearAuth();
    currentUser = null;
    updateNavbarUI();
    window.dispatchEvent(new CustomEvent('auth:changed', { detail: { loggedIn: false, user: null } }));
    API.showToast('Đổi mật khẩu thành công! Vui lòng đăng nhập lại.', 'success');
  };

  const updateProfile = async (profileData) => {
    const res = await API.put('/api/users/profile', profileData);
    if (res && res.data) {
      currentUser = { ...currentUser, ...res.data };
      localStorage.setItem('user_info', JSON.stringify(currentUser));
      updateNavbarUI();
      API.showToast('Cập nhật thông tin cá nhân thành công!', 'success');
      return currentUser;
    }
  };

  const isAuthenticated = () => {
    return Boolean(API.getAccessToken() && currentUser);
  };

  const isAdmin = () => {
    if (!currentUser || !currentUser.roles) return false;
    return currentUser.roles.includes('ADMIN') ||
      currentUser.roles.includes('ROLE_ADMIN') ||
      Array.from(currentUser.roles).some(r => r.toUpperCase().includes('ADMIN'));
  };

  const hasRole = (role) => {
    if (!currentUser || !currentUser.roles) return false;
    return currentUser.roles.includes(role) || currentUser.roles.includes('ROLE_' + role);
  };

  const getCurrentUser = () => currentUser;

  const updateNavbarUI = () => {
    const authActions = document.getElementById('navbar-auth-actions');
    const userMenu = document.getElementById('navbar-user-menu');
    const navMyDocs = document.getElementById('nav-item-my-documents');
    const navAdmin = document.getElementById('nav-item-admin');
    const userNameSpan = document.getElementById('navbar-username');
    const userAvatar = document.getElementById('navbar-avatar');
    const userRolesBadge = document.getElementById('navbar-roles-badge');

    if (isAuthenticated()) {
      if (authActions) authActions.classList.add('d-none');
      if (userMenu) userMenu.classList.remove('d-none');
      if (navMyDocs) navMyDocs.classList.remove('d-none');

      const name = currentUser.fullName || currentUser.username || 'User';
      if (userNameSpan) userNameSpan.textContent = name;
      if (userAvatar) userAvatar.textContent = name.charAt(0).toUpperCase();

      if (userRolesBadge) {
        const roles = Array.from(currentUser.roles || []);
        userRolesBadge.innerHTML = roles.map(r => `<span class="badge ${r.includes('ADMIN') ? 'bg-danger' : 'bg-primary'} me-1">${r}</span>`).join('');
      }

      if (isAdmin()) {
        if (navAdmin) navAdmin.classList.remove('d-none');
      } else {
        if (navAdmin) navAdmin.classList.add('d-none');
      }
    } else {
      if (authActions) authActions.classList.remove('d-none');
      if (userMenu) userMenu.classList.add('d-none');
      if (navMyDocs) navMyDocs.classList.add('d-none');
      if (navAdmin) navAdmin.classList.add('d-none');
    }
  };

  window.addEventListener('auth:expired', () => {
    API.clearAuth();
    currentUser = null;
    updateNavbarUI();
    window.dispatchEvent(new CustomEvent('auth:changed', { detail: { loggedIn: false, user: null } }));
  });

  return {
    init,
    login,
    register,
    logout,
    revokeOldSessions,
    revokeAllSessions,
    changePassword,
    updateProfile,
    fetchUserInfo,
    isAuthenticated,
    isAdmin,
    hasRole,
    getCurrentUser,
    updateNavbarUI
  };
})();
