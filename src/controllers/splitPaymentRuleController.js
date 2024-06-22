import axios from 'axios';
import { validationResult } from 'express-validator';
import { apiResponseList, apiResponse } from '../utils/apiResponseFormat.js';
import { connectTargetDatabase } from '../config/targetDatabase.js';
import { TemplateModel, templateSchema } from '../models/templateModel.js';
import { SplitPaymentRuleIdModel, splitPaymentRuleIdScheme } from '../models/splitPaymentRuleIdModel.js';
import 'dotenv/config';
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


    const { id_template, name, description, routes } = req.body;
    if (!id_template) {
      return apiResponse(res, 400, 'Template tidak ditemukan');
    }
    const totalPercentAmount = routes.reduce((acc, route) => acc + route.percent_amount, 0);
    if (totalPercentAmount !== 100) {
      return apiResponse(res, 400, 'total persen bagi-bagi pendapatan harus 100%');
    }
    const totalPercentFeePos = routes.reduce((acc, route) => acc + route.fee_pos, 0);
    if (totalPercentFeePos !== 100) {
      return apiResponse(res, 400, 'total persen bagi-bagi biaya harus 100%');
    }
    //template
    const dbTemplate = await connectTargetDatabase(targetDatabase);
    const TemplateModel = dbTemplate.model('Split_Payment_Rule', splitPaymentRuleIdScheme);
    const template = await TemplateModel.findById(id_template);
    if (!template) {
      return apiResponse(res, 404, 'Template tidak ditemukan');
    }
    // end template 


    const data = {
      'name': name,
      'description': description,
      'routes': [],
    };
    // Validasi dan pemetaan routes
    const garapinCost = 3;
    const routesValidate = routes.map(route => {
      return {
        'percent_amount': route.percent_amount - (garapinCost / 100 * route.fee_pos),
        'currency': route.currency,
        'destination_account_id': route.destination_account_id,
        'reference_id': route.reference_id
      };
    });
    console.log(routes);

    data.routes = routesValidate;
    data.routes.push({
      'percent_amount': garapinCost,
      'currency': 'IDR',
      'destination_account_id': '6602d442a5e108f758e0651d',
      'reference_id': 'garapin_pos'
    });

    console.log('total percent');
    console.log(totalPercentAmount);
    //check trx sudah terdaftar belum, karna satu trx satu split rule,
    const referenceIdTRX = routes.filter(item => item.type === 'TRX').map(item => item.reference_id);
    console.log(referenceIdTRX);
    const splitPaymentRuleId = await connectTargetDatabase(referenceIdTRX);
    const SplitPaymentRuleIdStore = splitPaymentRuleId.model('Split_Payment_Rule_Id', splitPaymentRuleIdScheme);
    const existRuleTRX = await SplitPaymentRuleIdStore.findOne({ id_template: id_template });
    if (!existRuleTRX) {
      return apiResponse(res, 400, 'Sudah terdaftar ditemplate lain');
    }
    const endpoint = 'https://api.xendit.co/split_rules';
    const headers = {
      'Authorization': `Basic ${Buffer.from(apiKey + ':').toString('base64')}`,
    };
    const response = await axios.post(endpoint, data, { headers });
    if (response.status === 200) {
      for (const route of response.data.routes) {
        const splitPaymentRuleId = await connectTargetDatabase(route.reference_id);
        const SplitPaymentRuleIdStore = splitPaymentRuleId.model('Split_Payment_Rule_Id', splitPaymentRuleIdScheme);

        // search SplitRuleId sudah ada belum
        const splitRuleId = await SplitPaymentRuleIdStore.findOne({ id_template: id_template });
        if (!splitRuleId) {
          const create = new SplitPaymentRuleIdStore({
            id: response.data.id,
            name: response.data.name,
            description: response.data.description,
            created_at: response.data.created_at,
            updated_at: response.data.updated_at,
            id_template: id_template, // Isi dengan nilai id_template yang sesuai
            routes: response.data.routes
          });
          const data = await create.save();
        } else {
          const update = {
            id: response.data.id,
            name: response.data.name,
            description: response.data.description,
            created_at: response.data.created_at,
            updated_at: response.data.updated_at,
            routes: response.data.routes
          };
          const data = await SplitPaymentRuleIdStore.findOneAndUpdate(
            { id_template: id_template },
            update,
            { new: true }
          );
        }
        // end search SplitRuleId sudah ada belum
      }

      console.log(response.data);

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
    const Template = db.model('Template', templateSchema);
    const { name, description, routes } = req.body;
    // if (routes.length > 4) {
    //   return apiResponse(res, 200, 'Target bagi-bagi maksimal 4');
    // }
    const create = new Template({ name: name, description: description, routes: routes });
    await create.save();

    return apiResponse(res, 200, 'Sukses membuat template', create);
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
    return apiResponse(res, 400, 'error');
  }
};
const addFeeCustomer = async (req, res) => {
  try {
    const targetDatabase = req.get('target-database');
    if (!targetDatabase) {
      return apiResponse(res, 400, 'Target database is not specified');
    }
    const db = await connectTargetDatabase(targetDatabase);
    const { id_template, percent_fee_cust } = req.body;
    const Template = db.model('Template', templateSchema);
    const existingTemplate = await Template.findById(id_template);
    const totalPercentFeePos = existingTemplate.routes.reduce((acc, route) => acc + route.fee_pos, 0);
    let updatedTemplate;
    if (totalPercentFeePos + percent_fee_cust !== 100) {
      updatedTemplate = await Template.findOneAndUpdate(
        { '_id': id_template },
        { $set: { status_template: 'INACTIVE', fee_cust: percent_fee_cust } },
        { new: true }
      );
    } else {
      updatedTemplate = await Template.findOneAndUpdate(
        { '_id': id_template },
        { $set: { status_template: 'ACTIVE', fee_cust: percent_fee_cust } },
        { new: true }
      );
    }
    return apiResponse(res, 200, 'Sukses add fee customer', updatedTemplate);
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
    return apiResponse(res, 400, 'error');
  }
};

const getSplitRuleTRX = async (req, res) => {
  const id = req.params.id;
  const splitPaymentRuleId = await connectTargetDatabase(id);
  const SplitPaymentRuleIdStore = splitPaymentRuleId.model('Split_Payment_Rule_Id', splitPaymentRuleIdScheme);
  const existRuleTRX = await SplitPaymentRuleIdStore.findOne();
  if (!existRuleTRX) {
    return apiResponse(res, 400, 'Sudah terdaftar ditemplate lain');
  }
  return apiResponse(res, 200, 'success', existRuleTRX);

};
const deleteTargetTemplate = async (req, res) => {
  try {
    const targetDatabase = req.get('target-database');
    if (!targetDatabase) {
      return apiResponse(res, 400, 'Target database is not specified');
    }
    const db = await connectTargetDatabase(targetDatabase);
    const Template = db.model('Template', templateSchema);
    const { id, reference_id } = req.body;
    if (!id) {
      return apiResponse(res, 400, 'Document ID is required');
    }
    const template = await Template.findById(id);

    if (!template) {
      return apiResponse(res, 404, 'Template not found');
    }
    template.status_template = 'INACTIVE';
    template.routes = template.routes.filter(data => data.reference_id !== reference_id);
    await template.save();
    return apiResponse(res, 200, 'success delete target');
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
    return apiResponse(res, 400, 'Error');
  }
};
// user.store_database_name = user.store_database_name.filter(db => db._id.toString() !== id_database);
const updateTemplate = async (req, res) => {
  try {
    const targetDatabase = req.get('target-database');
    if (!targetDatabase) {
      return apiResponse(res, 400, 'Target database is not specified');
    }

    const db = await connectTargetDatabase(targetDatabase);
    const Template = db.model('Template', templateSchema);

    const { id, reference_id, route } = req.body;


    if (!id) {
      return apiResponse(res, 400, 'Document ID is required');
    }
    const existingTemplate = await Template.findById(id);
    if (!existingTemplate) {
      return apiResponse(res, 404, 'Template not found');
    }

    // Jika reference_id ada, update rute yang cocok
    const existingRoute = existingTemplate.routes.find(r => r.reference_id === reference_id);
    if (existingRoute) {
      const updatedTemplate = await Template.findOneAndUpdate(
        { '_id': id, 'routes.reference_id': reference_id },
        { $set: { 'routes.$': route, status_template: 'INACTIVE' } },
        { new: true }
      );
      return apiResponse(res, 200, 'Template updated', updatedTemplate);
    } else {
      if (route.type === 'TRX') {
        if (existingTemplate.db_trx === route.reference_id) {
          console.log('sama nih');
          const updatedTemplate = await Template.findOneAndUpdate(
            { '_id': id, 'routes.type': 'TRX', status_template: 'INACTIVE' },
            { $set: { 'routes.$': route, status_template: 'INACTIVE', db_trx: route.reference_id } },
            { new: true }
          );
          console.log('sama nih3');
          return apiResponse(res, 200, 'Template updated', updatedTemplate);
        } else {
          console.log('sama nih 5');
          const dbTemplate = await connectTargetDatabase(targetDatabase);
          const Template = dbTemplate.model('Template', templateSchema);
          const template = await Template.find();
          const foundTemplate = template.find(temp => temp.db_trx && temp.db_trx.includes(route.reference_id));
          if (!foundTemplate) {
            const updatedTemplate = await Template.findOneAndUpdate(
              { '_id': id, 'routes.type': 'TRX', status_template: 'INACTIVE' },
              { $set: { 'routes.$': route, status_template: 'INACTIVE', db_trx: route.reference_id } },
              { new: true }
            );
            return apiResponse(res, 200, 'Template updated', updatedTemplate);
          } else {
            return apiResponse(res, 400, 'trx sudah digunakan ditemplate lain');
          }

        }
      } else {
        console.log(existingTemplate.routes.length);
        // if (existingTemplate.routes.length > 3) {
        //   return apiResponse(res, 400, 'Target bagi-bagi maksimal 4');
        // }
        const updatedTemplate = await Template.findOneAndUpdate(
          { '_id': id },
          {
            $push: { routes: route },
            $set: { status_template: 'INACTIVE' }
          }, // Memasukkan rute baru ke dalam array routes
          { new: true }
        );
        return apiResponse(res, 200, 'New data inserted into routes', updatedTemplate);
      }

    }
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
    return apiResponse(res, 400, 'Error');
  }
};

const activationTemplate = async (req, res) => {
  try {
    const targetDatabase = req.get('target-database');
    if (!targetDatabase) {
      return apiResponse(res, 400, 'Target database is not specified');
    }
    const db = await connectTargetDatabase(targetDatabase);
    const Template = db.model('Template', templateSchema);
    const { id_template, status } = req.body;
    if (!id_template) {
      return apiResponse(res, 400, 'Document ID is required');
    }
    const existingTemplate = await Template.findById(id_template);
    const totalPercentAmount = existingTemplate.routes.reduce((acc, route) => acc + route.percent_amount, 0);
    if (totalPercentAmount !== 100) {
      return apiResponse(res, 400, 'total persen bagi-bagi pendapatan harus 100%');
    }
    const totalPercentFeePos = existingTemplate.routes.reduce((acc, route) => acc + route.fee_pos, 0);
    if (totalPercentFeePos + existingTemplate.fee_cust !== 100) {
      return apiResponse(res, 400, 'total persen bagi-bagi biaya harus 100%');
    }
    if (!existingTemplate) {
      return apiResponse(res, 404, 'Template not found');
    }
    const updatedTemplate = await Template.findOneAndUpdate(
      { '_id': id_template },
      { $set: { status_template: status } },
      { new: true }
    );

    return apiResponse(res, 200, `Template ${status}`, updatedTemplate);
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
    const Template = db.model('Template', templateSchema);

    const templateId = req.params.id;

    const template = await Template.findById(templateId);

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
    const Template = db.model('Template', templateSchema);
    const template = await Template.find();
    if (!template) {
      return apiResponseList(res, 404, 'Template not found');
    }
    return apiResponseList(res, 200, 'Success', template);
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
    return apiResponseList(res, 400, error.message);
  }
};






export default { createSplitRule, createTemplate, getTemplateById, getAllTemplates, updateTemplate, getSplitRuleTRX, activationTemplate, deleteTargetTemplate, addFeeCustomer };