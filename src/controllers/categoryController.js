import { CategoryModel, categorySchema } from '../models/categoryModel.js';
import { connectTargetDatabase } from '../config/targetDatabase.js';
import { apiResponseList, apiResponse } from '../utils/apiResponseFormat.js';

const createCategory = async (req, res) => {
  try {
    const { category, description } = req.body;
    const targetDatabase = req.get('target-database');

    if (!targetDatabase) {
      return apiResponse(res, 400, 'error Database tujuan tidak spesifik');
    }

    const storeDatabase = await connectTargetDatabase(targetDatabase);

    const CategoryModelStore = storeDatabase.model('Category', categorySchema);

    let existingCategory = await CategoryModelStore.findOne({ category: { $regex: category, $options: 'i' } });

    if (existingCategory) {
      if (existingCategory.status !== 'ACTIVE') {
        existingCategory.status = 'ACTIVE';
        existingCategory = await existingCategory.save();
        return apiResponse(res, 200, `Sukses menambahkan kategori ${existingCategory.category}`, existingCategory);
      } else {
        return apiResponse(res, 200, 'Kategori sudah ada', existingCategory);
      }
    } else {
      const categoryDataInStoreDatabase = new CategoryModelStore({
        category,
        description,
      });

      const savedCategory = await categoryDataInStoreDatabase.save();
      return apiResponse(res, 200, `Kategori ${savedCategory.category} berhasil dibuat`, savedCategory);
    }
  } catch (error) {
    console.error('Error creating category:', error);
    return apiResponse(res, 500, 'Gagal membuat kategori');
  }
};

const deleteCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const targetDatabase = req.get('target-database');

    if (!targetDatabase) {
      return apiResponse(res, 400, 'Database tujuan tidak ditentukan');
    }

    const storeDatabase = await connectTargetDatabase(targetDatabase);
    const CategoryModelStore = storeDatabase.model('Category', categorySchema);

    const category = await CategoryModelStore.findById(id);

    if (!category) {
      return apiResponse(res, 404, 'Kategori tidak ditemukan');
    }

    category.status = 'DELETED';
    const deletedCategory = await category.save();

    return apiResponse(res, 200, 'Kategori berhasil dihapus', deletedCategory);
  } catch (error) {
    console.error('Kesalahan saat menghapus kategori:', error);
    return apiResponse(res, 500, 'Gagal menghapus kategori');
  }
};


const editCategory = async (req, res) => {
  try {
    const targetDatabase = req.get('target-database');
    if (!targetDatabase) {
      return apiResponse(res, 400, 'Target database is not specified');
    }
    const storeDatabase = await connectTargetDatabase(targetDatabase);
    const CategoryModelStore = storeDatabase.model('Category', categorySchema);
    const { category, description, id } = req.body;

    if (!id) {
      return apiResponse(res, 400, 'Category ID is required');
    }

    const updatedCategory = await CategoryModelStore.findByIdAndUpdate(
      id,
      { category, description },
      { new: true }
    );

    if (!updatedCategory) {
      return apiResponse(res, 400, 'Category not found');
    }
    return apiResponse(res, 200, 'Category updated successfully', updatedCategory);
  } catch (error) {
    console.error('Error editing category:', error);
    return apiResponse(res, 500, 'Failed to edit category');
  }
};

const getAllCategories = async (req, res) => {
  try {
    const targetDatabase = req.get('target-database');

    if (!targetDatabase) {
      return apiResponseList(res, 400, 'Target database is not specified');
    }

    const storeDatabase = await connectTargetDatabase(targetDatabase);

    const CategoryModelStore = storeDatabase.model('Category', categorySchema);

    // Retrieve all categories
    const allCategories = await CategoryModelStore.find({ status: { $ne: 'DELETED' } });

    const responseCategories = [{ _id: 'Semua', category: 'Semua', description: 'All Categories' }, ...allCategories];


    return apiResponseList(res, 200, 'success', responseCategories);
  } catch (error) {
    console.error('Failed to get all categories:', error);
    return apiResponseList(res, 500, 'Failed to get all categories');
  }
};
const getSingleCategories = async (req, res) => {
  try {
    const id = req.params.id;
    const targetDatabase = req.get('target-database');

    if (!targetDatabase) {
      return apiResponse(res, 400, 'Target database is not specified');
    }

    const storeDatabase = await connectTargetDatabase(targetDatabase);

    const CategoryModelStore = storeDatabase.model('Category', categorySchema);

    // Retrieve all categories
    const singleCategory = await CategoryModelStore.findById(id);

    return apiResponse(res, 200, 'success', singleCategory);
  } catch (error) {
    console.error('Failed to get all categories:', error);
    return apiResponse(res, 500, 'Failed to get all categories');
  }
};


export default { createCategory, editCategory, getAllCategories, getSingleCategories, deleteCategory };
