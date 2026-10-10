/**
 * API Service & Network Layer
 * Handles Bearer JWT authentication, silent token refresh, file downloads, and notification dialogs
 */

const API = (() => {
  // Cấu hình URL Backend:
  // - Nếu mở trực tiếp từ Spring Boot (port 8080) -> dùng relative path ''
  // - Nếu mở từ server khác (python port 5500, Apache port 80, Live Server...) -> trỏ về http://localhost:8080
  const port = window.location.port;
  let BASE_URL;

  if (port === '8000' || port === '') {
    // Frontend chạy qua Apache hoặc domain mặc định.
    // API đi cùng origin: Apache -> Inspector -> Spring Boot.
    BASE_URL = '';
  } else if (port === '8080') {
    // Mở frontend trực tiếp từ Spring Boot.
    BASE_URL = '';
  } else {
    // Dev server khác: vẫn đi qua Apache để tránh CORS.
    BASE_URL = 'http://localhost:8000';
  }

  console.log(
    '[DocSafe API] Backend API Base URL:',
    BASE_URL || '(Same Origin)'
  );

  const getAccessToken = () => localStorage.getItem('access_token');
  const getRefreshToken = () => localStorage.getItem('refresh_token');

  const setAuthTokens = (token, refreshToken) => {
    if (token) localStorage.setItem('access_token', token);
    if (refreshToken) localStorage.setItem('refresh_token', refreshToken);
  };

  const clearAuth = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user_info');
  };

  let isRefreshing = false;
  let refreshSubscribers = [];

  const subscribeTokenRefresh = (cb) => {
    refreshSubscribers.push(cb);
  };

  const onRefreshed = (token) => {
    refreshSubscribers.forEach((cb) => cb(token));
    refreshSubscribers = [];
  };

  const refreshToken = async () => {
    const currentRefreshToken = getRefreshToken();
    if (!currentRefreshToken) {
      throw new Error('Không có refresh token');
    }

    try {
      const response = await fetch(`${BASE_URL}/api/auth/refresh-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: currentRefreshToken })
      });

      const result = await response.json();
      if (response.ok && result.code === 1000 && result.data?.token) {
        setAuthTokens(result.data.token, result.data.refreshToken);
        return result.data.token;
      } else {
        clearAuth();
        throw new Error(result.message || 'Phiên đăng nhập đã hết hạn');
      }
    } catch (err) {
      clearAuth();
      throw err;
    }
  };

  const request = async (url, options = {}) => {
    options.headers = options.headers || {};

    const token = getAccessToken();
    if (token && !options.headers['Authorization']) {
      options.headers['Authorization'] = `Bearer ${token}`;
    }

    // Set JSON content-type if not FormData
    if (!(options.body instanceof FormData) && !options.headers['Content-Type']) {
      options.headers['Content-Type'] = 'application/json';
    }

    let response = await fetch(`${BASE_URL}${url}`, options);

    // If 401 Unauthorized, attempt refresh token
    if (response.status === 401 && getRefreshToken() && !url.includes('/api/auth/login') && !url.includes('/api/auth/refresh-token')) {
      if (!isRefreshing) {
        isRefreshing = true;
        try {
          const newToken = await refreshToken();
          isRefreshing = false;
          onRefreshed(newToken);
        } catch (refreshErr) {
          isRefreshing = false;
          refreshSubscribers = [];
          showToast('Phiên làm việc đã hết hạn. Vui lòng đăng nhập lại.', 'warning');
          window.dispatchEvent(new CustomEvent('auth:expired'));
          throw refreshErr;
        }
      }

      // Retry request with new token
      return new Promise((resolve, reject) => {
        subscribeTokenRefresh((newToken) => {
          options.headers['Authorization'] = `Bearer ${newToken}`;
          fetch(`${BASE_URL}${url}`, options)
            .then(res => res.json())
            .then(data => {
              if (data.code === 1000) resolve(data);
              else reject(new Error(data.message || 'Có lỗi xảy ra'));
            })
            .catch(reject);
        });
      });
    }

    // For file download or non-json responses handled elsewhere
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      if (!response.ok) {
        throw new Error(`Yêu cầu thất bại với mã lỗi HTTP ${response.status}`);
      }
      return response;
    }

    const data = await response.json();
    if (!response.ok || data.code !== 1000) {
      const errorMessage = data.message || `Lỗi (${data.code || response.status})`;
      const error = new Error(errorMessage);
      error.code = data.code;
      error.data = data;
      throw error;
    }

    return data;
  };

  // Helper for downloading file with authorization
  const downloadFile = async (url, defaultName = 'download') => {
    try {
      const token = getAccessToken();
      const headers = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const response = await fetch(`${BASE_URL}${url}`, { method: 'GET', headers });
      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Vui lòng đăng nhập để tải tài liệu này.');
        } else if (response.status === 403) {
          throw new Error('Bạn không có quyền tải xuống tài liệu này.');
        } else if (response.status === 404) {
          throw new Error('Không tìm thấy tập tin tài liệu.');
        } else {
          throw new Error(`Tải tệp thất bại (HTTP ${response.status})`);
        }
      }

      // Extract filename from Content-Disposition header if available
      let fileName = defaultName;
      const disposition = response.headers.get('content-disposition');
      if (disposition && disposition.indexOf('filename=') !== -1) {
        const matches = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/.exec(disposition);
        if (matches != null && matches[1]) {
          fileName = matches[1].replace(/['"]/g, '');
        }
      }

      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(downloadUrl);
      document.body.removeChild(a);

      showToast(`Đã tải xuống: ${fileName}`, 'success');
    } catch (err) {
      showToast(err.message, 'error');
      throw err;
    }
  };

  // Notification utilities using SweetAlert2
  const showToast = (message, icon = 'info') => {
    if (window.Swal) {
      const Toast = Swal.mixin({
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 3500,
        timerProgressBar: true,
        didOpen: (toast) => {
          toast.addEventListener('mouseenter', Swal.stopTimer);
          toast.addEventListener('mouseleave', Swal.resumeTimer);
        }
      });
      Toast.fire({
        icon: icon,
        title: message
      });
    } else {
      alert(message);
    }
  };

  const confirmDialog = async (title, text, confirmButtonText = 'Đồng ý', confirmButtonColor = '#ef4444') => {
    if (window.Swal) {
      const result = await Swal.fire({
        title,
        text,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: confirmButtonColor,
        cancelButtonColor: '#64748b',
        confirmButtonText: confirmButtonText,
        cancelButtonText: 'Hủy bỏ'
      });
      return result.isConfirmed;
    }
    return confirm(`${title}\n${text}`);
  };

  return {
    get: (url, opts) => request(url, { ...opts, method: 'GET' }),
    post: (url, body, opts) => request(url, { ...opts, method: 'POST', body: body instanceof FormData ? body : JSON.stringify(body) }),
    put: (url, body, opts) => request(url, { ...opts, method: 'PUT', body: body instanceof FormData ? body : JSON.stringify(body) }),
    delete: (url, opts) => request(url, { ...opts, method: 'DELETE' }),
    downloadFile,
    getAccessToken,
    getRefreshToken,
    setAuthTokens,
    clearAuth,
    showToast,
    confirmDialog
  };
})();
