package managedocuments.example.managedocuments.service;

import managedocuments.example.managedocuments.dto.request.CategoryRequest;
import managedocuments.example.managedocuments.dto.response.CategoryResponse;

import java.util.List;

public interface CategoryService {

    List<CategoryResponse> getAllCategories();

    CategoryResponse getCategoryById(Integer id);

    CategoryResponse createCategory(CategoryRequest request);

    CategoryResponse updateCategory(Integer id, CategoryRequest request);

    void deleteCategory(Integer id);
}
