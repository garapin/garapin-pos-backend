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



export default { createSplitRule };