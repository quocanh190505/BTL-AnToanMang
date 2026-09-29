/**
 * Documents Management Module
 * Handles document browsing, filtering, search, pagination, upload, edit, download, and delete
 */

const Documents = (() => {
  let state = {
    mode: 'all', // 'all' or 'my'
    keyword: '',
    categoryId: '',
    isPublic: '',
    page: 0,
    size: 9,
    sort: 'createdAt,desc',
    viewMode: 'grid', // 'grid' or 'table'
    totalPages: 0,
    totalElements: 0,
    documents: []
  };

  const getFileIconClass = (fileName) => {
    if (!fileName) return { icon: 'bi-file-earmark', type: 'default' };
    const ext = fileName.split('.').pop().toLowerCase();
    if (ext === 'pdf') return { icon: 'bi-file-earmark-pdf-fill', type: 'pdf' };
    if (['doc', 'docx'].includes(ext)) return { icon: 'bi-file-earmark-word-fill', type: 'word' };
    if (['xls', 'xlsx', 'csv'].includes(ext)) return { icon: 'bi-file-earmark-excel-fill', type: 'excel' };
    if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) return { icon: 'bi-file-earmark-zip-fill', type: 'archive' };
    if (['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp'].includes(ext)) return { icon: 'bi-file-earmark-image-fill', type: 'image' };
    if (['txt', 'md', 'json', 'xml', 'java', 'js', 'html', 'css', 'py'].includes(ext)) return { icon: 'bi-file-earmark-code-fill', type: 'code' };
    return { icon: 'bi-file-earmark-text-fill', type: 'default' };
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('vi-VN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (e) {
      return dateStr;
    }
  };

  const canEditOrDelete = (doc) => {
    if (!Auth.isAuthenticated()) return false;
    if (Auth.isAdmin()) return true;
    const user = Auth.getCurrentUser();
    return user && (user.username === doc.ownerUsername || user.id === doc.ownerId);
  };

  const loadDocuments = async (customParams = {}) => {
    state = { ...state, ...customParams };

    const loadingSpinner = document.getElementById('docs-loading');
    const containerGrid = document.getElementById('docs-grid-view');
    const containerTable = document.getElementById('docs-table-view');

    if (loadingSpinner) loadingSpinner.classList.remove('d-none');
    if (containerGrid) containerGrid.classList.add('d-none');
    if (containerTable) containerTable.classList.add('d-none');

    try {
      let endpoint = '';
      const params = new URLSearchParams();
      params.append('page', state.page);
      params.append('size', state.size);
      params.append('sort', state.sort);

      if (state.mode === 'my') {
        if (!Auth.isAuthenticated()) {
          API.showToast('Vui lòng đăng nhập để xem tài liệu của bạn.', 'info');
          setMode('all');
          return;
        }
        endpoint = `/api/documents/my-documents?${params.toString()}`;
      } else {
        if (state.keyword) params.append('keyword', state.keyword);
        if (state.categoryId) params.append('categoryId', state.categoryId);
        if (state.isPublic !== '') params.append('isPublic', state.isPublic);
        endpoint = `/api/documents?${params.toString()}`;
      }

      const res = await API.get(endpoint);
      if (res && res.data) {
        state.documents = res.data.content || [];
        state.totalPages = res.data.totalPages || 0;
        state.totalElements = res.data.totalElements || 0;
        state.page = res.data.number || 0;

        renderDocuments();
        renderPagination();
        updateStats();
      }
    } catch (err) {
      console.error('Failed to load documents', err);
      API.showToast(err.message || 'Không thể tải danh sách tài liệu', 'error');
    } finally {
      if (loadingSpinner) loadingSpinner.classList.add('d-none');
    }
  };

  const renderDocuments = () => {
    const gridContainer = document.getElementById('docs-grid-view');
    const tableContainer = document.getElementById('docs-table-view');
    const tableBody = document.getElementById('docs-table-body');
    const emptyState = document.getElementById('docs-empty-state');

    if (state.documents.length === 0) {
      if (gridContainer) gridContainer.classList.add('d-none');
      if (tableContainer) tableContainer.classList.add('d-none');
      if (emptyState) emptyState.classList.remove('d-none');
      return;
    }

    if (emptyState) emptyState.classList.add('d-none');

    if (state.viewMode === 'grid') {
      if (gridContainer) gridContainer.classList.remove('d-none');
      if (tableContainer) tableContainer.classList.add('d-none');
      renderGrid();
    } else {
      if (gridContainer) gridContainer.classList.add('d-none');
      if (tableContainer) tableContainer.classList.remove('d-none');
      renderTable();
    }
  };

  const renderGrid = () => {
    const container = document.getElementById('docs-grid-cards');
    if (!container) return;

    container.innerHTML = state.documents.map(doc => {
      const iconInfo = getFileIconClass(doc.fileName);
      const isOwnerOrAdmin = canEditOrDelete(doc);

      return `
        <div class="col-lg-4 col-md-6 mb-4">
          <div class="card card-custom doc-card h-100 p-3">
            <div>
              <div class="d-flex align-items-start justify-content-between mb-2">
                <div class="doc-file-icon ${iconInfo.type}">
                  <i class="bi ${iconInfo.icon}"></i>
                </div>
                <div class="text-end">
                  <span class="badge ${doc.isPublic ? 'bg-success bg-opacity-10 text-success' : 'bg-warning bg-opacity-10 text-dark'} mb-1">
                    <i class="bi ${doc.isPublic ? 'bi-globe2' : 'bi-lock-fill'} me-1"></i>
                    ${doc.isPublic ? 'Công khai' : 'Riêng tư'}
                  </span>
                  <div>
                    <span class="badge badge-cat text-truncate" style="max-width: 140px;">
                      <i class="bi bi-tag-fill me-1"></i> ${escapeHtml(doc.categoryName || 'Chưa phân loại')}
                    </span>
                  </div>
                </div>
              </div>

              <h6 class="doc-title mt-2 mb-1" title="${escapeHtml(doc.title)}">
                ${escapeHtml(doc.title)}
              </h6>
              <p class="doc-desc" title="${escapeHtml(doc.description || '')}">
                ${escapeHtml(doc.description || 'Không có phần mô tả ngắn.')}
              </p>
            </div>

            <div class="mt-3 pt-2 border-top">
              <div class="d-flex align-items-center justify-content-between text-muted small mb-3">
                <span><i class="bi bi-person me-1"></i> ${escapeHtml(doc.ownerUsername || 'Ẩn danh')}</span>
                <span><i class="bi bi-clock me-1"></i> ${formatDate(doc.createdAt)}</span>
              </div>

              <div class="d-flex gap-2">
                <button class="btn btn-sm btn-outline-secondary flex-grow-1" onclick="Documents.viewDetails(${doc.id})">
                  <i class="bi bi-eye me-1"></i> Chi tiết
                </button>
                <button class="btn btn-sm btn-primary flex-grow-1" onclick="Documents.download(${doc.id}, '${escapeJs(doc.fileName)}')">
                  <i class="bi bi-download me-1"></i> Tải về
                </button>
                ${isOwnerOrAdmin ? `
                  <div class="dropdown">
                    <button class="btn btn-sm btn-light border" type="button" data-bs-toggle="dropdown" aria-expanded="false">
                      <i class="bi bi-three-dots-vertical"></i>
                    </button>
                    <ul class="dropdown-menu dropdown-menu-end shadow-sm">
                      <li>
                        <a class="dropdown-item" href="javascript:void(0)" onclick="Documents.openEditModal(${doc.id})">
                          <i class="bi bi-pencil me-2 text-primary"></i> Sửa tài liệu
                        </a>
                      </li>
                      <li><hr class="dropdown-divider"></li>
                      <li>
                        <a class="dropdown-item text-danger" href="javascript:void(0)" onclick="Documents.deleteDocument(${doc.id})">
                          <i class="bi bi-trash me-2"></i> Xóa tài liệu
                        </a>
                      </li>
                    </ul>
                  </div>
                ` : ''}
              </div>
            </div>
          </div>
        </div>
      `;
    }).join('');
  };

  const renderTable = () => {
    const tableBody = document.getElementById('docs-table-body');
    if (!tableBody) return;

    tableBody.innerHTML = state.documents.map(doc => {
      const iconInfo = getFileIconClass(doc.fileName);
      const isOwnerOrAdmin = canEditOrDelete(doc);

      return `
        <tr>
          <td>
            <div class="d-flex align-items-center">
              <div class="doc-file-icon ${iconInfo.type} me-3" style="width: 38px; height: 38px; font-size: 1.2rem;">
                <i class="bi ${iconInfo.icon}"></i>
              </div>
              <div>
                <a href="javascript:void(0)" onclick="Documents.viewDetails(${doc.id})" class="fw-bold text-decoration-none text-dark d-block">
                  ${escapeHtml(doc.title)}
                </a>
                <small class="text-muted text-truncate d-inline-block" style="max-width: 250px;">
                  ${escapeHtml(doc.fileName || 'Không có tên tệp')}
                </small>
              </div>
            </div>
          </td>
          <td>
            <span class="badge badge-cat">
              ${escapeHtml(doc.categoryName || 'Chưa phân loại')}
            </span>
          </td>
          <td>
            <span class="badge ${doc.isPublic ? 'bg-success bg-opacity-10 text-success' : 'bg-warning bg-opacity-10 text-dark'}">
              <i class="bi ${doc.isPublic ? 'bi-globe2' : 'bi-lock-fill'} me-1"></i>
              ${doc.isPublic ? 'Công khai' : 'Riêng tư'}
            </span>
          </td>
          <td>
            <small><i class="bi bi-person me-1"></i> ${escapeHtml(doc.ownerUsername || 'Ẩn danh')}</small>
          </td>
          <td>
            <small class="text-muted">${formatDate(doc.createdAt)}</small>
          </td>
          <td class="text-end">
            <button class="btn btn-sm btn-outline-secondary me-1" onclick="Documents.viewDetails(${doc.id})" title="Chi tiết">
              <i class="bi bi-eye"></i>
            </button>
            <button class="btn btn-sm btn-primary me-1" onclick="Documents.download(${doc.id}, '${escapeJs(doc.fileName)}')" title="Tải xuống">
              <i class="bi bi-download"></i>
            </button>
            ${isOwnerOrAdmin ? `
              <button class="btn btn-sm btn-outline-primary me-1" onclick="Documents.openEditModal(${doc.id})" title="Sửa">
                <i class="bi bi-pencil"></i>
              </button>
              <button class="btn btn-sm btn-outline-danger" onclick="Documents.deleteDocument(${doc.id})" title="Xóa">
                <i class="bi bi-trash"></i>
              </button>
            ` : ''}
          </td>
        </tr>
      `;
    }).join('');
  };

  const renderPagination = () => {
    const paginationContainer = document.getElementById('docs-pagination');
    const paginationInfo = document.getElementById('docs-pagination-info');

    if (!paginationContainer) return;

    if (state.totalElements === 0) {
      paginationContainer.innerHTML = '';
      if (paginationInfo) paginationInfo.textContent = '0 tài liệu';
      return;
    }

    const start = state.page * state.size + 1;
    const end = Math.min((state.page + 1) * state.size, state.totalElements);
    if (paginationInfo) {
      paginationInfo.textContent = `Hiển thị ${start} - ${end} / tổng số ${state.totalElements} tài liệu`;
    }

    if (state.totalPages <= 1) {
      paginationContainer.innerHTML = '';
      return;
    }

    let items = [];

    // Previous button
    items.push(`
      <li class="page-item ${state.page === 0 ? 'disabled' : ''}">
        <a class="page-link" href="javascript:void(0)" onclick="Documents.goToPage(${state.page - 1})" aria-label="Previous">
          <i class="bi bi-chevron-left"></i>
        </a>
      </li>
    `);

    // Visible page range
    const maxVisible = 5;
    let startPage = Math.max(0, state.page - Math.floor(maxVisible / 2));
    let endPage = Math.min(state.totalPages - 1, startPage + maxVisible - 1);
    if (endPage - startPage + 1 < maxVisible) {
      startPage = Math.max(0, endPage - maxVisible + 1);
    }

    for (let p = startPage; p <= endPage; p++) {
      items.push(`
        <li class="page-item ${p === state.page ? 'active' : ''}">
          <a class="page-link" href="javascript:void(0)" onclick="Documents.goToPage(${p})">${p + 1}</a>
        </li>
      `);
    }

    // Next button
    items.push(`
      <li class="page-item ${state.page >= state.totalPages - 1 ? 'disabled' : ''}">
        <a class="page-link" href="javascript:void(0)" onclick="Documents.goToPage(${state.page + 1})" aria-label="Next">
          <i class="bi bi-chevron-right"></i>
        </a>
      </li>
    `);

    paginationContainer.innerHTML = items.join('');
  };

  const goToPage = (page) => {
    if (page < 0 || page >= state.totalPages) return;
    loadDocuments({ page });
  };

  const updateStats = () => {
    const totalDocsCount = document.getElementById('stat-total-docs');
    if (totalDocsCount && state.mode === 'all') {
      totalDocsCount.textContent = state.totalElements;
    }
  };

  const setMode = (mode) => {
    state.mode = mode;
    state.page = 0;

    const btnAll = document.getElementById('tab-docs-all');
    const btnMy = document.getElementById('tab-docs-my');

    if (mode === 'all') {
      if (btnAll) btnAll.classList.add('active');
      if (btnMy) btnMy.classList.remove('active');
    } else {
      if (btnAll) btnAll.classList.remove('active');
      if (btnMy) btnMy.classList.add('active');
    }

    loadDocuments();
  };

  const setViewMode = (mode) => {
    state.viewMode = mode;
    const btnGrid = document.getElementById('btn-view-grid');
    const btnTable = document.getElementById('btn-view-table');

    if (mode === 'grid') {
      if (btnGrid) btnGrid.classList.add('active');
      if (btnTable) btnTable.classList.remove('active');
    } else {
      if (btnGrid) btnGrid.classList.remove('active');
      if (btnTable) btnTable.classList.add('active');
    }

    renderDocuments();
  };

  const viewDetails = async (id) => {
    try {
      const res = await API.get(`/api/documents/${id}`);
      if (res && res.data) {
        const doc = res.data;
        const iconInfo = getFileIconClass(doc.fileName);

        document.getElementById('detail-doc-icon').className = `doc-file-icon ${iconInfo.type} me-3`;
        document.getElementById('detail-doc-icon-i').className = `bi ${iconInfo.icon}`;
        document.getElementById('detail-doc-title').textContent = doc.title;
        document.getElementById('detail-doc-category').textContent = doc.categoryName || 'Chưa phân loại';
        document.getElementById('detail-doc-public').innerHTML = doc.isPublic
          ? '<span class="badge bg-success"><i class="bi bi-globe2 me-1"></i> Công khai</span>'
          : '<span class="badge bg-warning text-dark"><i class="bi bi-lock-fill me-1"></i> Riêng tư</span>';
        document.getElementById('detail-doc-filename').textContent = doc.fileName || '—';
        document.getElementById('detail-doc-owner').textContent = doc.ownerUsername || '—';
        document.getElementById('detail-doc-created').textContent = formatDate(doc.createdAt);
        document.getElementById('detail-doc-updated').textContent = formatDate(doc.updatedAt);
        document.getElementById('detail-doc-desc').textContent = doc.description || 'Không có mô tả chi tiết.';

        // Setup download button
        const dlBtn = document.getElementById('detail-doc-download-btn');
        dlBtn.onclick = () => download(doc.id, doc.fileName);

        // Edit & Delete actions inside detail modal
        const actionsContainer = document.getElementById('detail-doc-actions');
        if (canEditOrDelete(doc)) {
          actionsContainer.innerHTML = `
            <button class="btn btn-outline-primary me-2" onclick="Documents.openEditModal(${doc.id}); bootstrap.Modal.getInstance(document.getElementById('docDetailModal')).hide();">
              <i class="bi bi-pencil me-1"></i> Sửa
            </button>
            <button class="btn btn-outline-danger" onclick="Documents.deleteDocument(${doc.id}); bootstrap.Modal.getInstance(document.getElementById('docDetailModal')).hide();">
              <i class="bi bi-trash me-1"></i> Xóa
            </button>
          `;
        } else {
          actionsContainer.innerHTML = '';
        }

        const modal = new bootstrap.Modal(document.getElementById('docDetailModal'));
        modal.show();
      }
    } catch (err) {
      API.showToast(err.message, 'error');
    }
  };

  const download = (id, fileName) => {
    API.downloadFile(`/api/documents/${id}/download`, fileName || `document-${id}`);
  };

  const openUploadModal = () => {
    if (!Auth.isAuthenticated()) {
      API.showToast('Vui lòng đăng nhập để tải lên tài liệu!', 'warning');
      const loginModal = new bootstrap.Modal(document.getElementById('loginModal'));
      loginModal.show();
      return;
    }

    document.getElementById('doc-form-id').value = '';
    document.getElementById('doc-form-title').value = '';
    document.getElementById('doc-form-desc').value = '';
    document.getElementById('doc-form-category').value = '';
    document.getElementById('doc-form-public').checked = true;
    document.getElementById('doc-file-input').value = '';
    document.getElementById('doc-selected-filename').textContent = 'Chưa chọn tệp tin';
    document.getElementById('doc-file-wrapper').classList.remove('d-none');
    document.getElementById('doc-file-input').required = true;

    document.getElementById('docModalTitle').innerHTML = '<i class="bi bi-cloud-upload me-2 text-primary"></i> Tải Lên Tài Liệu Mới';
    document.getElementById('doc-submit-btn').innerHTML = '<i class="bi bi-cloud-upload me-1"></i> Tải Lên';

    const modal = new bootstrap.Modal(document.getElementById('docFormModal'));
    modal.show();
  };

  const openEditModal = async (id) => {
    try {
      const res = await API.get(`/api/documents/${id}`);
      if (res && res.data) {
        const doc = res.data;
        document.getElementById('doc-form-id').value = doc.id;
        document.getElementById('doc-form-title').value = doc.title;
        document.getElementById('doc-form-desc').value = doc.description || '';
        document.getElementById('doc-form-category').value = doc.categoryId;
        document.getElementById('doc-form-public').checked = Boolean(doc.isPublic);

        // Hide file input in edit mode as backend PUT /api/documents/{id} only updates metadata
        document.getElementById('doc-file-wrapper').classList.add('d-none');
        document.getElementById('doc-file-input').required = false;

        document.getElementById('docModalTitle').innerHTML = '<i class="bi bi-pencil-square me-2 text-primary"></i> Cập Nhật Tài Liệu';
        document.getElementById('doc-submit-btn').innerHTML = '<i class="bi bi-check2 me-1"></i> Lưu Thay Đổi';

        const modal = new bootstrap.Modal(document.getElementById('docFormModal'));
        modal.show();
      }
    } catch (err) {
      API.showToast(err.message, 'error');
    }
  };

  const saveDocument = async (e) => {
    if (e) e.preventDefault();

    const id = document.getElementById('doc-form-id').value;
    const title = document.getElementById('doc-form-title').value.trim();
    const categoryId = document.getElementById('doc-form-category').value;
    const description = document.getElementById('doc-form-desc').value.trim();
    const isPublic = document.getElementById('doc-form-public').checked;

    if (!title) {
      API.showToast('Vui lòng nhập tiêu đề tài liệu', 'warning');
      return;
    }

    if (!categoryId) {
      API.showToast('Vui lòng chọn danh mục tài liệu', 'warning');
      return;
    }

    const submitBtn = document.getElementById('doc-submit-btn');
    const originalText = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span> Đang xử lý...';

    try {
      if (id) {
        // Edit mode (PUT)
        await API.put(`/api/documents/${id}`, {
          title,
          description,
          categoryId: parseInt(categoryId),
          isPublic
        });
        API.showToast('Cập nhật tài liệu thành công!', 'success');
      } else {
        // Upload mode (POST multipart)
        const fileInput = document.getElementById('doc-file-input');
        if (!fileInput.files || fileInput.files.length === 0) {
          API.showToast('Vui lòng chọn tệp tin cần tải lên', 'warning');
          submitBtn.disabled = false;
          submitBtn.innerHTML = originalText;
          return;
        }

        const formData = new FormData();
        formData.append('file', fileInput.files[0]);
        formData.append('title', title);
        formData.append('description', description);
        formData.append('categoryId', categoryId);
        formData.append('isPublic', isPublic);

        await API.post('/api/documents', formData);
        API.showToast('Tải lên tài liệu thành công!', 'success');
      }

      const modalEl = document.getElementById('docFormModal');
      const modal = bootstrap.Modal.getInstance(modalEl);
      if (modal) modal.hide();

      await loadDocuments();
    } catch (err) {
      API.showToast(err.message, 'error');
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalText;
    }
  };

  const deleteDocument = async (id) => {
    const confirmed = await API.confirmDialog(
      'Xác nhận xóa tài liệu',
      'Bạn có chắc chắn muốn xóa tài liệu này? Tập tin vật lý trên hệ thống cũng sẽ bị xóa!'
    );
    if (!confirmed) return;

    try {
      await API.delete(`/api/documents/${id}`);
      API.showToast('Đã xóa tài liệu thành công!', 'success');
      await loadDocuments();
    } catch (err) {
      API.showToast(err.message, 'error');
    }
  };

  return {
    state,
    loadDocuments,
    renderDocuments,
    goToPage,
    setMode,
    setViewMode,
    viewDetails,
    download,
    openUploadModal,
    openEditModal,
    saveDocument,
    deleteDocument
  };
})();
