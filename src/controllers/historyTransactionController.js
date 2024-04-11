import axios from 'axios';
import { validationResult } from 'express-validator';
import { apiResponseList, apiResponse } from '../utils/apiResponseFormat.js';
import { connectTargetDatabase } from '../config/targetDatabase.js';
import { ProductModel, productSchema } from '../models/productModel.js';
import { TransactionModel, transactionSchema } from '../models/transactionModel.js';
import { CartModel, cartSchema } from '../models/cartModel.js';
import { StoreModel, storeSchema } from '../models/storeModel.js';
import { PaymentMethodModel, paymentMethodScheme } from '../models/paymentMethodModel.js';
import { SplitPaymentRuleIdModel, splitPaymentRuleIdScheme } from '../models/splitPaymentRuleIdModel.js';
import { ConfigCostModel, configCostSchema } from '../models/configCost.js';
import { DatabaseModel, databaseScheme } from '../models/databaseModel.js';
import { TemplateModel, templateSchema } from '../models/templateModel.js';

const XENDIT_API_KEY = process.env.XENDIT_API_KEY;
const XENDIT_WEBHOOK_URL = process.env.XENDIT_WEBHOOK_URL;

import moment from 'moment';
import  getForUserIdXenplatform  from '../utils/getForUserIdXenplatform.js';

const historyTransaction = async (req, res) => {
  try {
    // const param = req.params.id;
    const { database, param } = req.body;
    console.log(database);
    console.log(param);
    const apiKey = XENDIT_API_KEY;  
    // const targetDatabase = req.get('target-database');
    console.log(database);
    const forUserId = await  getForUserIdXenplatform(database);
    const endpoint = `https://api.xendit.co//transactions?${param}`;
    console.log(endpoint);
    const headers = {
      'Authorization': `Basic ${Buffer.from(apiKey + ':').toString('base64')}`,
      'for-user-id': forUserId,
    };  
    const response = await axios.get(endpoint, { headers });
      return apiResponse(res, response.status, 'Sukses membuat invoice', response.data);
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
    return apiResponse(res, 400);
  }
};


const getFilterStore = async (req, res) => {
    try {
      const targetDatabase = req.get('target-database');
      const role = req.params.role;
  
      if (!targetDatabase) {
        return apiResponse(res, 400, 'database tidak ditemukan');
      }
     const databases = await DatabaseModel.find();
      const result = [];
      for (const dbInfo of databases) {
        const dbName = dbInfo.db_name;
        const emailOwner = dbInfo.email_owner;
        const database = await connectTargetDatabase(dbName);
        const StoreModelDatabase = database.model('Store', storeSchema);
        const data = await StoreModelDatabase.findOne({ id_parent: targetDatabase });
        console.log('ini target daata');
        console.log(targetDatabase);
        console.log(data);
        if (data != null) {
          if (data.merchant_role === role && data.store_status === 'ACTIVE') {
            const db = await connectTargetDatabase(targetDatabase);
            const Template = db.model('Template', templateSchema);
            const template = await Template.findOne({ db_trx : dbName });
              result.push({
                db_name: dbName,
                email_owner: emailOwner ?? null,
                store_name: data.store_name,
                account_id: data.account_holder.id,
                template_id : template._id,
                template_name : template.name,
                template_status: template.status_template,
                created: data.createdAt,
                updated: data.updatedAt,
              });
          }
        }
      }
      console.log(result);
      return apiResponseList(res, 200, 'success', result);
    } catch (err) {
      console.error(err);
      return apiResponseList(res, 400, 'error');
    }
  };




  const transactionDetail = async (req, res) => {
    try {
      const { database, invoice } = req.body;
     const db = await connectTargetDatabase(database);
     const SplitData = db.model('Split_Payment_Rule_Id', splitPaymentRuleIdScheme);
     const split = await SplitData.findOne({ invoice:invoice });
  
    const StoreData = db.model('Store', storeSchema);
    const store = await StoreData.findOne();

    console.log(store);

    const dbParent = await connectTargetDatabase(store.id_parent);
    const Template= dbParent.model('Template', templateSchema);
    const template = await Template.findOne({ _id: split.id_template });
    const newRoute = {
      type: 'FEE',
      target: 'Garapin',
      fee_pos: 0,
      flat_amount: null,
      percent_amount: 0,
      currency: 'IDR',
      destination_account_id: '',
      reference_id: ''
    };
    template.routes.push(newRoute);
    return apiResponse(res, 200, 'Ambil history', { split, template });
    } catch (error) {
      console.error('Error:', error.response?.data || error.message);
      return apiResponse(res, 400);
    }
  };









export default { historyTransaction, getFilterStore, transactionDetail };