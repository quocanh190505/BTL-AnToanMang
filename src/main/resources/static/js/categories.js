/**
 * Category Management Module
 */

const Categories = (() => {
  let categoryList = [];

  const loadCategories = async () => {
    try {
      const res = await API.get('/api/categories');
      if (res && res.data) {
        categoryList = res.data;
        populateCategoryDropdowns();
        renderCategoryCards();
        renderCategoryAdminTable();
        return categoryList;
      }
    } catch (err) {
      console.error('Failed to load categories', err);
    }
    return [];
  };

  const getCategories = () => categoryList;

  const populateCategoryDropdowns = () => {
    // 1. Filter dropdown on document explorer
    const filterSelect = document.getElementById('filter-category');
    if (filterSelect) {
      const currentValue = filterSelect.value;
      if (categoryList.length === 0) {
        filterSelect.innerHTML = '<option value="">-- Chưa có danh mục --</option>';
      } else {
        filterSelect.innerHTML = '<option value="">-- Tất cả danh mục --</option>' +
          categoryList.map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('');
      }
      filterSelect.value = currentValue;
    }

    // 2. Category select in Document Upload / Edit Modal
    const docModalSelect = document.getElementById('doc-form-category');
    const catWarning = document.getElementById('doc-form-category-warning');
    const quickCatBtn = document.getElementById('doc-btn-quick-cat');

    if (quickCatBtn) {
      if (Auth.isAdmin()) {
        quickCatBtn.classList.remove('d-none');
      } else {
        quickCatBtn.classList.add('d-none');
      }
    }

    if (docModalSelect) {
      const currentValue = docModalSelect.value;
      if (categoryList.length === 0) {
        docModalSelect.innerHTML = '<option value="" disabled selected>-- Chưa có danh mục nào trong hệ thống --</option>';
        if (catWarning) catWarning.classList.remove('d-none');
      } else {
        docModalSelect.innerHTML = '<option value="" disabled selected>-- Chọn danh mục phù hợp --</option>' +
          categoryList.map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('');
        if (catWarning) catWarning.classList.add('d-none');
        if (currentValue) docModalSelect.value = currentValue;
      }
    }
  };

  const renderCategoryCards = () => {
    const container = document.getElementById('category-cards-container');
    if (!container) return;

    if (categoryList.length === 0) {
      container.innerHTML = `
        <div class="col-12 text-center py-5 text-muted">
          <i class="bi bi-folder2-open display-4 d-block mb-3 text-secondary"></i>
          <h5 class="fw-bold text-dark">Chưa có danh mục tài liệu nào</h5>
          <p class="small text-muted mb-3">Hệ thống hiện tại chưa có danh mục để phân loại tài liệu.</p>
          ${Auth.isAdmin() ? `
            <button class="btn btn-primary btn-sm" onclick="Categories.openCreateModal()">
              <i class="bi bi-folder-plus me-1"></i> Tạo danh mục mới ngay
            </button>
          ` : `
            <div class="alert alert-info d-inline-block small py-2 px-3">
              <i class="bi bi-info-circle me-1"></i> Khởi động lại backend để nạp danh mục mẫu hoặc đăng nhập với tài khoản Quản trị viên để tạo danh mục.
            </div>
          `}
        </div>`;
      return;
    }

    container.innerHTML = categoryList.map(cat => `
      <div class="col-md-4 col-sm-6 mb-4">
        <div class="card card-custom h-100 p-3 category-item-card cursor-pointer" onclick="Categories.filterDocumentsByCategory(${cat.id}, '${escapeJs(cat.name)}')">
          <div class="d-flex align-items-center mb-2">
            <div class="stat-icon bg-primary bg-opacity-10 text-primary me-3">
              <i class="bi bi-folder-fill"></i>
            </div>
            <div>
              <h6 class="mb-0 fw-bold text-dark">${escapeHtml(cat.name)}</h6>
              <small class="text-muted">Mã: #${cat.id}</small>
            </div>
          </div>
          <p class="text-muted small mb-0 mt-2 flex-grow-1">
            ${escapeHtml(cat.description || 'Không có mô tả chi tiết')}
          </p>
          <div class="mt-3 pt-2 border-top d-flex justify-content-between align-items-center">
            <span class="badge bg-light text-primary border">Xem tài liệu <i class="bi bi-arrow-right"></i></span>
            ${Auth.isAdmin() ? `
              <div>
                <button class="btn btn-sm btn-outline-primary me-1" onclick="event.stopPropagation(); Categories.openEditModal(${cat.id})" title="Chỉnh sửa"><i class="bi bi-pencil"></i></button>
                <button class="btn btn-sm btn-outline-danger" onclick="event.stopPropagation(); Categories.deleteCategory(${cat.id})" title="Xóa"><i class="bi bi-trash"></i></button>
              </div>
            ` : ''}
          </div>
        </div>
      </div>
    `).join('');
  };

  const renderCategoryAdminTable = () => {
    const tableBody = document.getElementById('admin-categories-table-body');
    if (!tableBody) return;

    if (categoryList.length === 0) {
      tableBody.innerHTML = `<tr><td colspan="4" class="text-center py-4 text-muted">Chưa có danh mục</td></tr>`;
      return;
    }

    tableBody.innerHTML = categoryList.map(cat => `
      <tr>
        <td class="fw-bold">#${cat.id}</td>
        <td>
          <span class="badge bg-primary bg-opacity-10 text-primary fs-6 px-2 py-1">
            <i class="bi bi-folder-fill me-1"></i> ${escapeHtml(cat.name)}
          </span>
        </td>
        <td class="text-muted">${escapeHtml(cat.description || '—')}</td>
        <td class="text-end">
          <button class="btn btn-sm btn-outline-primary me-1" onclick="Categories.openEditModal(${cat.id})">
            <i class="bi bi-pencil me-1"></i> Sửa
          </button>
          <button class="btn btn-sm btn-outline-danger" onclick="Categories.deleteCategory(${cat.id})">
            <i class="bi bi-trash me-1"></i> Xóa
          </button>
        </td>
      </tr>
    `).join('');
  };

  const filterDocumentsByCategory = (categoryId, categoryName) => {
    showMainView('documents');
    const categorySelect = document.getElementById('filter-category');
    if (categorySelect) {
      categorySelect.value = categoryId;
      Documents.loadDocuments({ categoryId, page: 0 });
    }
  };

  const openCreateModal = () => {
    document.getElementById('category-form-id').value = '';
    document.getElementById('category-form-name').value = '';
    document.getElementById('category-form-desc').value = '';
    document.getElementById('categoryModalTitle').textContent = 'Thêm Danh Mục Mới';
    const modal = new bootstrap.Modal(document.getElementById('categoryModal'));
    modal.show();
  };

  const openEditModal = async (id) => {
    try {
      const res = await API.get(`/api/categories/${id}`);
      if (res && res.data) {
        const cat = res.data;
        document.getElementById('category-form-id').value = cat.id;
        document.getElementById('category-form-name').value = cat.name;
        document.getElementById('category-form-desc').value = cat.description || '';
        document.getElementById('categoryModalTitle').textContent = 'Chỉnh Sửa Danh Mục';
        const modal = new bootstrap.Modal(document.getElementById('categoryModal'));
        modal.show();
      }
    } catch (err) {
      API.showToast(err.message, 'error');
    }
  };

  const saveCategory = async (e) => {
    if (e) e.preventDefault();
    const id = document.getElementById('category-form-id').value;
    const name = document.getElementById('category-form-name').value.trim();
    const description = document.getElementById('category-form-desc').value.trim();

    if (!name) {
      API.showToast('Vui lòng nhập tên danh mục', 'warning');
      return;
    }

    try {
      if (id) {
        await API.put(`/api/categories/${id}`, { name, description });
        API.showToast('Cập nhật danh mục thành công!', 'success');
      } else {
        await API.post('/api/categories', { name, description });
        API.showToast('Tạo danh mục mới thành công!', 'success');
      }

      const modalEl = document.getElementById('categoryModal');
      const modal = bootstrap.Modal.getInstance(modalEl);
      if (modal) modal.hide();

      await loadCategories();
    } catch (err) {
      API.showToast(err.message, 'error');
    }
  };

  const deleteCategory = async (id) => {
    const confirmed = await API.confirmDialog(
      'Xác nhận xóa danh mục',
      'Bạn có chắc chắn muốn xóa danh mục này? Thao tác này không thể hoàn tác!'
    );
    if (!confirmed) return;

    try {
      await API.delete(`/api/categories/${id}`);
      API.showToast('Xóa danh mục thành công!', 'success');
      await loadCategories();
      Documents.loadDocuments(); // refresh documents in case category changed
    } catch (err) {
      API.showToast(err.message, 'error');
    }
  };

  return {
    loadCategories,
    getCategories,
    populateCategoryDropdowns,
    renderCategoryCards,
    renderCategoryAdminTable,
    filterDocumentsByCategory,
    openCreateModal,
    openEditModal,
    saveCategory,
    deleteCategory
  };
})();
