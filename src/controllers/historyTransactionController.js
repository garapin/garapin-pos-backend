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

const XENDIT_API_KEY = process.env.XENDIT_API_KEY;
const XENDIT_WEBHOOK_URL = process.env.XENDIT_WEBHOOK_URL;

import moment from 'moment';
import { templateSchema } from '../models/templateModel.js';
import  getForUserIdXenplatform  from '../utils/getForUserIdXenplatform.js';

const historyTransaction = async (req, res) => {
  try {
    const param = req.params.id;
    const apiKey = XENDIT_API_KEY; 
    const targetDatabase = req.get('target-database');
    console.log(targetDatabase);
    const forUserId = await  getForUserIdXenplatform(targetDatabase);
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


const getFilter = async (req, res) => {
    // jika bussiness partner get semua trx buat filter

    // jika trx cuman dia sendiri
};











export default { historyTransaction };