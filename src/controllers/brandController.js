import { BrandModel, brandSchema } from '../models/brandmodel.js';
import { apiResponseList, apiResponse } from '../utils/apiResponseFormat.js';
import { connectTargetDatabase, closeConnection } from '../config/targetDatabase.js';

const getAllBrands = async (req, res) => {
    try {
        const targetDatabase = req.get('target-database');

    if (!targetDatabase) {
      return apiResponseList(res, 400, 'error', 'Target database is not specified');
    }
    const storeDatabase = await connectTargetDatabase(targetDatabase);
    const data = await storeDatabase.model('Brand', brandSchema).find();

    closeConnection(storeDatabase);
      return apiResponseList(res, 200, "success get data", data)
    } catch (error) {
      console.error('Error fetching brands:', error);
      return apiResponseList(res, 400, "success get data")
    }
  };

  const getBrandById = async (req, res) => {
    try {
        const targetDatabase = req.get('target-database');
        const id = req.params.id;
    if (!targetDatabase) {
      return apiResponse(res, 400, 'error', 'Target database is not specified');
    }
    const storeDatabase = await connectTargetDatabase(targetDatabase);
    const data = await storeDatabase.model('Brand', brandSchema).findById(id);

    closeConnection(storeDatabase);
      return apiResponse(res, 200, "success get data", data)
    } catch (error) {
      console.error('Error fetching brands:', error);
      return apiResponse(res, 400, "error")
    }
  };

  const createBrand = async (req, res) => {
    try {
      const { brand, production, description } = req.body;
      const targetDatabase = req.get('target-database');

  if (!targetDatabase) {
    return apiResponse(res, 400, 'error', 'Target database is not specified');
  }

  const storeDatabase = await connectTargetDatabase(targetDatabase);

  const BrandModelStore = storeDatabase.model('Brand', brandSchema);

  const storeDataInStoreDatabase = new BrandModelStore({
    brand: brand,
    production: production,
    description:description,
  });
   const savedBrand = await storeDataInStoreDatabase.save();
   return apiResponse(res, 200, 'Brand created successfully', savedBrand);
    } catch (error) {
      console.error('Error creating brand:', error);
      return apiResponse(res, 500, error);
    }
  };
  const editBrand = async (req, res) => {
    try {
      const targetDatabase = req.get('target-database');
      if (!targetDatabase) {
        return apiResponse(res, 400, 'error', 'Target database is not specified');
      }
      const storeDatabase = await connectTargetDatabase(targetDatabase);
      const BrandModelStore = storeDatabase.model('Brand', brandSchema);
      const { brand, production, description, id } = req.body;
      if (!id) {
        return apiResponse(res, 400, 'error', 'Brand ID is required');
      }
  
      const updatedBrand = await BrandModelStore.findByIdAndUpdate(
        id,
        { brand, production, description },
        { new: true } 
      );
  
      if (!updatedBrand) {
        return apiResponse(res, 400, 'error', 'Brand not found');
      }
  
      return apiResponse(res, 200, 'Brand updated successfully', updatedBrand);
    } catch (error) {
      console.error('Error editing brand:', error);
      return apiResponse(res, 500, 'error', 'Failed to edit brand');
    }
  };
  
  export default { getAllBrands, getBrandById, createBrand, editBrand };