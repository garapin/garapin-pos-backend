import axios from 'axios';
import { apiResponseList, apiResponse } from '../utils/apiResponseFormat.js';
import { StoreModel, storeSchema } from '../models/storeModel.js';
import { connectTargetDatabase } from '../config/targetDatabase.js';
import { hashPin, verifyPin } from '../utils/hashPin.js';
import getForUserId from '../utils/getForUserIdXenplatform.js';
const MONGODB_URI = process.env.MONGODB_URI;
const XENDIT_API_KEY = process.env.XENDIT_API_KEY;

const getBalance = async (req, res) => {
    try {
    const targetDatabase = req.get('target-database');
    const database = await connectTargetDatabase(targetDatabase);
    const storeModel = await database.model('Store', storeSchema).findOne();
    const endpoint = 'https://api.xendit.co/balance';
console.log(storeModel.account_holder.id);
const headers = {
  'Authorization': `Basic ${Buffer.from(XENDIT_API_KEY + ':').toString('base64')}`,
  'for-user-id': storeModel.account_holder.id,
};
const response = await axios.get(endpoint, { headers });
const responseData = {
    'balance' : response.data.balance,
    'bank': storeModel.bank_account
};
return apiResponse(res, 200, 'Sukses ambil balance', responseData);
    } catch (error) {
        return apiResponse(res, 400, 'error');
    }
};

const verifyPinWIthdrawl = async (req, res) => {
    try {
        const { pin } = req.body;
        const targetDatabase = req.get('target-database');
        const database = await connectTargetDatabase(targetDatabase);
        const storeModel = await database.model('Store', storeSchema).findOne();
        const isPinValid = verifyPin(pin, storeModel.bank_account.pin);
        if (isPinValid) {
            return apiResponse(res, 200, 'pin match');
        } else {
            return apiResponse(res, 400, 'missmatch');
        }
    } catch (error) {
        return apiResponse(res, 400, 'terjadi kesalahan');
    }
   
};


const withdrawl = async (req, res) => {
    // try {
    const timestamp = new Date().getTime();
    const targetDatabase = req.get('target-database');
    const database = await connectTargetDatabase(targetDatabase);
    const storeModel = await database.model('Store', storeSchema).findOne();

   const data = {
        'external_id': storeModel.account_holder.id+'&&'+timestamp,
        'amount': req.body.amount,
        'bank_code':  storeModel.bank_account.bank_name,
        'account_holder_name': storeModel.bank_account.holder_name,
        'account_number': storeModel.bank_account.account_number.toString(),
        'description':'Withdraw from BagiBagiPos',
        'email_to':[storeModel.account_holder.email]
     };

    const endpoint = 'https://api.xendit.co/disbursements';
    const headers = {
    //   'Content-Type':'application/json',
      'Authorization': `Basic ${Buffer.from(XENDIT_API_KEY + ':').toString('base64')}`,
      'for-user-id': storeModel.account_holder.id,
      'X-IDEMPOTENCY-KEY': storeModel.account_holder.id+'&&'+timestamp
    };
    const response = await axios.post(endpoint, data, { headers });
    console.log(response.data);
    if (response.status === 200) {
        return apiResponse(res, 200, 'Sukses', response.data);
    } else {
        return apiResponse(res, 400, 'error', response);
    }
    // } catch (error) {
    //     return apiResponse(res, 400, 'error', error);
    // }
    
};


export default { getBalance, verifyPinWIthdrawl, withdrawl };