import { CategoryModel, categorySchema } from '../models/categoryModel.js';
import { connectTargetDatabase, closeConnection } from '../config/targetDatabase.js';
import { apiResponseList, apiResponse } from '../utils/apiResponseFormat.js';

const createCategory = async (req, res) => {
  try {
    const { category, description } = req.body;
    const targetDatabase = req.get('target-database');

    if (!targetDatabase) {
      return apiResponse(res, 400, 'Target database is not specified');
    }

    const storeDatabase = await connectTargetDatabase(targetDatabase);

    const CategoryModelStore = storeDatabase.model('Category', categorySchema);

    const categoryDataInStoreDatabase = new CategoryModelStore({
      category,
      description,
    });

    const savedCategory = await categoryDataInStoreDatabase.save();
    return apiResponse(res, 200, 'Category created successfully', savedCategory);
  } catch (error) {
    console.error('Error creating category:', error);
    return apiResponse(res, 500, 'Failed to create category');
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
      { new: true } // Return the updated document
    );

    if (!updatedCategory) {
      return apiResponse(res, 400,  'Category not found');
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
        return apiResponse(res, 400,  'Target database is not specified');
      }
  
      const storeDatabase = await connectTargetDatabase(targetDatabase);
  
      const CategoryModelStore = storeDatabase.model('Category', categorySchema);
  
      // Retrieve all categories
      const allCategories = await CategoryModelStore.find();
  
      return apiResponseList(res, 200, 'success', allCategories);
    } catch (error) {
      console.error('Failed to get all categories:', error);
      return apiResponseList(res, 500,  'Failed to get all categories');
    }
  };
  

export default { createCategory, editCategory, getAllCategories };
