import { UnitModel, unitSchema } from '../models/unitModel.js';
import { connectTargetDatabase } from '../config/targetDatabase.js';
import { apiResponseList, apiResponse } from '../utils/apiResponseFormat.js';

const createUnit = async (req, res) => {
  try {
    const { unit, description } = req.body;
    const targetDatabase = req.get('target-database');

    if (!targetDatabase) {
      return apiResponse(res, 400, 'Target database is not specified');
    }

    const storeDatabase = await connectTargetDatabase(targetDatabase);

    const UnitModelStore = storeDatabase.model('Unit', unitSchema);

    const unitDataInStoreDatabase = new UnitModelStore({
      unit,
      description,
    });

    const savedUnit = await unitDataInStoreDatabase.save();
    return apiResponse(res, 200, 'Unit created successfully', savedUnit);
  } catch (error) {
    console.error('Error creating unit:', error);
    return apiResponse(res, 500, 'Failed to create unit');
  }
};

const editUnit = async (req, res) => {
  try {
    const targetDatabase = req.get('target-database');
    if (!targetDatabase) {
      return apiResponse(res, 400, 'Target database is not specified');
    }

    const storeDatabase = await connectTargetDatabase(targetDatabase);
    const UnitModelStore = storeDatabase.model('Unit', unitSchema);

    const { unit, description, id } = req.body;

    if (!id) {
      return apiResponse(res, 400, 'Unit ID is required');
    }

    const updatedUnit = await UnitModelStore.findByIdAndUpdate(
      id,
      { unit, description },
      { new: true } // Return the updated document
    );

    if (!updatedUnit) {
      return apiResponse(res, 400, 'Unit not found');
    }

    return apiResponse(res, 200, 'Unit updated successfully', updatedUnit);
  } catch (error) {
    console.error('Error editing unit:', error);
    return apiResponse(res, 500, 'Failed to edit unit');
  }
};

const getAllUnits = async (req, res) => {
  try {
    const targetDatabase = req.get('target-database');

    if (!targetDatabase) {
      return apiResponse(res, 400, 'Target database is not specified');
    }

    const storeDatabase = await connectTargetDatabase(targetDatabase);
    const UnitModelStore = storeDatabase.model('Unit', unitSchema);

    // Retrieve all units
    const allUnits = await UnitModelStore.find();

    return apiResponseList(res, 200, 'success', allUnits);
  } catch (error) {
    console.error('Failed to get all units:', error);
    return apiResponseList(res, 500, 'Failed to get all units');
  }
};
const getSingleUnits = async (req, res) => {
    try {
    const id = req.params.id;
      const targetDatabase = req.get('target-database');
  
      if (!targetDatabase) {
        return apiResponse(res, 400, 'Target database is not specified');
      }
  
      const storeDatabase = await connectTargetDatabase(targetDatabase);
      const UnitModelStore = storeDatabase.model('Unit', unitSchema);
  
      // Retrieve all units
      const singleUnit = await UnitModelStore.findById(id);
  
      return apiResponse(res, 200, 'success', singleUnit);
    } catch (error) {
      console.error('Failed to get all units:', error);
      return apiResponse(res, 500, 'Failed to get all units');
    }
  };

export default { createUnit, editUnit, getAllUnits, getSingleUnits };
