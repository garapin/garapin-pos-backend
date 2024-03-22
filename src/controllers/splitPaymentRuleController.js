import axios from 'axios';
import { validationResult } from 'express-validator';
import { apiResponseList, apiResponse } from '../utils/apiResponseFormat.js';
import { connectTargetDatabase } from '../config/targetDatabase.js';
import { SplitPaymentRuleModel, splitPaymentRuleSchema } from '../models/splitPaymentRuleModel.js';

const XENDIT_API_KEY = process.env.XENDIT_API_KEY;
const XENDIT_WEBHOOK_URL = process.env.XENDIT_WEBHOOK_URL;
import moment from 'moment';



const createSplitRule = async (req, res) => {
    try {
      const targetDatabase = req.get('target-database');
      const apiKey = XENDIT_API_KEY; 

      if (!targetDatabase) {
        return apiResponse(res, 400, 'Target database is not specified');
      }
      const splitPaymentRule = await connectTargetDatabase(targetDatabase);
      const SplitPaymentRuleStore = splitPaymentRule.model('Split_Payment_Rule', splitPaymentRuleSchema);
      
      const { name, description, routes } = req.body;

      const data = {
        'name': name,
        'description': description,
        'routes': routes
        // frontend isi dibawah
    //     [{
    //       'flat_amount': 3000,
    //       'currency': 'IDR',
    //       'destination_account_id':   '65f5d221e9cf06f2ccc5c03e',
    //       'reference_id': '1'
    //       },
    //     {
    //      'percent_amount': 5,
    //         'currency': 'IDR',
    //       'destination_account_id':   '65f2fc2f440e6b029116157b',
    //         'reference_id': '2'
    //     }
    // ]
    };
      const endpoint = 'https://api.xendit.co/split_rules';
      const headers = {
        'Authorization': `Basic ${Buffer.from(apiKey + ':').toString('base64')}`,
      };
  
      const response = await axios.post(endpoint, data, { headers });
      if (response.status === 200) {
        const create = new SplitPaymentRuleStore(data);
         await create.save();
         return apiResponse(res, 200, 'Sukses membuat split rule', response.data);
      }
      return apiResponse(res, 400, 'gagal');
     
    
    } catch (error) {
      console.error('Error:', error.response?.data || error.message);
      return apiResponse(res, 400, 'error');
    }
  };


const createTemplate = async (req, res) => {
  try {
    const targetDatabase = req.get('target-database');
    if (!targetDatabase) {
      return apiResponse(res, 400, 'Target database is not specified');
    }
    const db = await connectTargetDatabase(targetDatabase);
    const SplitPaymentRuleStore = db.model('Split_Payment_Rule', splitPaymentRuleSchema);
    const { name, description, routes } = req.body;
    const create = new SplitPaymentRuleStore({ name:name, description:description, routes:routes });
    await create.save();
    return apiResponse(res, 200, 'Sukses membuat template', create);
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
    return apiResponse(res, 400, 'error');
  }
};
// const updateTemplate = async (req, res) => {
//   try {
//     const targetDatabase = req.get('target-database');
//     if (!targetDatabase) {
//       return apiResponse(res, 400, 'Target database is not specified');
//     }
    
//     const db = await connectTargetDatabase(targetDatabase);
//     const SplitPaymentRuleStore = db.model('Split_Payment_Rule', splitPaymentRuleSchema);
    
//     const { reference_id, route } = req.body; // Mengambil satu rute dari permintaan

//     const existingTemplate = await SplitPaymentRuleStore.findOne({ 'routes.reference_id': reference_id });

//     if (existingTemplate) {
//       // Jika reference_id ada, update rute yang cocok
//       const updatedTemplate = await SplitPaymentRuleStore.findOneAndUpdate(
//         { 'routes.reference_id': reference_id },
//         { $set: { 'routes.$': route } }, // Menggunakan $ untuk mengidentifikasi rute yang sesuai
//         { new: true }
//       );
//       return apiResponse(res, 200, 'Template updated', updatedTemplate);
//     } else {
//       // Jika reference_id tidak ada, masukkan data baru ke dalam array rute
//       const updatedTemplate = await SplitPaymentRuleStore.findOneAndUpdate(
//         {},
//         { $push: { routes: route } }, // Memasukkan rute baru ke dalam array routes
//         { new: true, upsert: true }
//       );
//       return apiResponse(res, 200, 'New data inserted into routes', updatedTemplate);
//     }
//   } catch (error) {
//     console.error('Error:', error.response?.data || error.message);
//     return apiResponse(res, 400, 'Error');
//   }
// };

const updateTemplate = async (req, res) => {
  try {
    const targetDatabase = req.get('target-database');
    if (!targetDatabase) {
      return apiResponse(res, 400, 'Target database is not specified');
    }
    
    const db = await connectTargetDatabase(targetDatabase);
    const SplitPaymentRuleStore = db.model('Split_Payment_Rule', splitPaymentRuleSchema);
    
    const { id, reference_id, route } = req.body; // Mengambil id dokumen, reference_id, dan rute dari permintaan

    // Periksa apakah id dokumen disertakan dalam permintaan
    if (!id) {
      return apiResponse(res, 400, 'Document ID is required');
    }

    // Cari dokumen berdasarkan id
    const existingTemplate = await SplitPaymentRuleStore.findById(id);

    if (!existingTemplate) {
      return apiResponse(res, 404, 'Template not found');
    }

    // Jika reference_id ada, update rute yang cocok
    const existingRoute = existingTemplate.routes.find(r => r.reference_id === reference_id);
    if (existingRoute) {
      const updatedTemplate = await SplitPaymentRuleStore.findOneAndUpdate(
        { '_id': id, 'routes.reference_id': reference_id }, // Filter berdasarkan id dan reference_id
        { $set: { 'routes.$': route } }, // Menggunakan $ untuk mengidentifikasi rute yang sesuai
        { new: true }
      );
      return apiResponse(res, 200, 'Template updated', updatedTemplate);
    } else {
      // Jika reference_id tidak ada, masukkan data baru ke dalam array rute
      const updatedTemplate = await SplitPaymentRuleStore.findOneAndUpdate(
        { '_id': id },
        { $push: { routes: route } }, // Memasukkan rute baru ke dalam array routes
        { new: true }
      );
      return apiResponse(res, 200, 'New data inserted into routes', updatedTemplate);
    }
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
    return apiResponse(res, 400, 'Error');
  }
};



const getTemplateById = async (req, res) => {
  try {
    const targetDatabase = req.get('target-database');
    if (!targetDatabase) {
      return apiResponse(res, 400, 'Target database is not specified');
    }
    const db = await connectTargetDatabase(targetDatabase);
    const SplitPaymentRuleStore = db.model('Split_Payment_Rule', splitPaymentRuleSchema);

    const templateId = req.params.id;

    const template = await SplitPaymentRuleStore.findById(templateId);

    if (!template) {
      return apiResponse(res, 404, 'Template not found');
    }
    return apiResponse(res, 200, 'Success', template);
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
    return apiResponse(res, 400, 'Error');
  }
};

const getAllTemplates = async (req, res) => {
  try {
    const targetDatabase = req.get('target-database');
    if (!targetDatabase) {
      return apiResponseList(res, 400, 'Target database is not specified');
    }
    const db = await connectTargetDatabase(targetDatabase);
    const SplitPaymentRuleStore = db.model('Split_Payment_Rule', splitPaymentRuleSchema);
    const template = await SplitPaymentRuleStore.find();
    if (!template) {
      return apiResponseList(res, 404, 'Template not found');
    }
    return apiResponseList(res, 200, 'Success', template);
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
    return apiResponseList(res, 400,  error.message);
  }
};






export default { createSplitRule, createTemplate, getTemplateById, getAllTemplates, updateTemplate };