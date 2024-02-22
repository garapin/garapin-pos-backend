import { UnitModel, unitSchema } from '../models/unitModel.js';
import { connectTargetDatabase } from '../config/targetDatabase.js';
import { apiResponseList, apiResponse } from '../utils/apiResponseFormat.js';

const createUnit = async (req, res) => {
  try {
    const { unit, description } = req.body;
    const targetDatabase = req.get('target-database');

    if (!targetDatabase) {
      return apiResponse(res, 400, 'error', 'Database tujuan tidak spesifik');
    }

    const storeDatabase = await connectTargetDatabase(targetDatabase);

    const UnitModelStore = storeDatabase.model('Unit', unitSchema);

    // Cari unit dalam database
    const existingUnit = await UnitModelStore.findOne({ unit: { $regex: unit, $options: 'i' } });

    if (existingUnit) {
      if (existingUnit.status !== 'ACTIVE') {
        existingUnit.status = 'ACTIVE';
        await existingUnit.save();
        return apiResponse(res, 200, `Sukses menambahkan unit ${existingUnit.unit}`, existingUnit);
      } else {
        return apiResponse(res, 200, `Unit ${existingUnit.unit} sudah ada`, existingUnit);
      }
    } else {
      const unitDataInStoreDatabase = new UnitModelStore({
        unit,
        description,
      });

      const savedUnit = await unitDataInStoreDatabase.save();
      return apiResponse(res, 200, `Berhasil membuat unit ${savedUnit.unit}`, savedUnit);
    }
  } catch (error) {
    console.error('Error creating unit:', error);
    return apiResponse(res, 500, 'Gagal membuat unit');
  }
};

const deleteUnit = async (req, res) => {
  try {
      const { id } = req.params;
      const targetDatabase = req.get('target-database');

      if (!targetDatabase) {
          return apiResponse(res, 400, 'Target database is not specified');
      }

      const storeDatabase = await connectTargetDatabase(targetDatabase);
      const UnitModelStore = storeDatabase.model('Unit', unitSchema);

      const unit = await UnitModelStore.findById(id);
      if (!unit) {
          return apiResponse(res, 404, 'Unit not found');
      }
      unit.status = 'DELETED';
      await unit.save();


      return apiResponse(res, 200, 'hapus unit sukses');
  } catch (error) {
      console.error('Error deleting unit:', error);
      return apiResponse(res, 500, 'Failed to delete unit');
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
      { new: true } 
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

    const allUnits = await UnitModelStore.find({ status: { $ne: 'DELETED' } });

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
  
      const singleUnit = await UnitModelStore.findById(id);
  
      return apiResponse(res, 200, 'success', singleUnit);
    } catch (error) {
      console.error('Failed to get all units:', error);
      return apiResponse(res, 500, 'Failed to get all units');
    }
  };

export default { createUnit, editUnit, getAllUnits, getSingleUnits, deleteUnit };
