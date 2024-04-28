import axios from 'axios';
import { apiResponseList, apiResponse } from '../utils/apiResponseFormat.js';
import { StoreModel, storeSchema } from '../models/storeModel.js';
import { WithdrawModel, withdrawSchema } from '../models/withdrawModel.js';
import { ConfigWithdrawModel, configWithdrawSchema } from '../models/configWithdraw.js';
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
    try {
    const timestamp = new Date().getTime();
    const generateDisb = `DISB-${timestamp}`;
    const targetDatabase = req.get('target-database');
    const database = await connectTargetDatabase(targetDatabase);
    const storeModel = await database.model('Store', storeSchema).findOne();
    const amount = await amountWithReducedfee(req.body.amount);
    if (amount === null) {
        return apiResponse(res, 400, 'terjadi kesalahan');
    }
    console.log('ini amount');
    console.log(amount);
    const dataPayout = {
            'reference_id': `${generateDisb}&&${targetDatabase}&&POS`,
            'channel_code': req.body.channel_code,
            'channel_properties': {
                'account_holder_name': storeModel.bank_account.holder_name,
                'account_number': storeModel.bank_account.account_number.toString()
            },
            'amount': amount,
            'description': 'Withdraw from BagiBagiPos',
            'currency': 'IDR',
            'receipt_notification' : {
                'email_to': [storeModel.account_holder.email],
                'email_cc': []
            }
    };
//    const data = {
//         'external_id': `${generateDisb}&&${targetDatabase}&&POS`,
//         'amount': req.body.amount,
//         'bank_code':  storeModel.bank_account.bank_name,
//         'account_holder_name': storeModel.bank_account.holder_name,
//         'account_number': storeModel.bank_account.account_number.toString(),
//         'description':'Withdraw from BagiBagiPos',
//         'email_to':[storeModel.account_holder.email]
//      };

    const endpoint = 'https://api.xendit.co/v2/payouts';
    const headers = {
      'Content-Type':'application/json',
      'Authorization': `Basic ${Buffer.from(XENDIT_API_KEY + ':').toString('base64')}`,
      'for-user-id': storeModel.account_holder.id,
      'Idempotency-key': `${generateDisb}&&${targetDatabase}&&POS`
    };
    const response = await axios.post(endpoint, dataPayout, { headers });
    console.log(response.status);
    console.log(response.data);
    if (response.status === 200) {
        const withdrawData =  database.model('Withdraw', withdrawSchema);
        const addWithdraw =  new withdrawData(response.data);
        const save = await addWithdraw.save();
        return apiResponse(res, 200, 'Sukses', response.data);
    } else {
        return apiResponse(res, 400, 'error', response);
    }
    } catch (error) {
        return apiResponse(res, 400, 'error', error);
    }
    
};

const withdrawCheckAmount = async (req, res) => {
    try {
        const { amount } = req.body;
        const data = await ConfigWithdrawModel.findOne({ type:'BANK' });
        console.log(data);
        const vat =  data.fee * data.vat_percent/100;
        const totalFee = data.fee + vat;
        console.log(totalFee);
        const count = amount - totalFee;
        return apiResponse(res, 200, 'ok', { 'amount':amount, 'total_fee': totalFee, 'amount_to_bank': count });
    } catch (error) {
        return apiResponse(res, 200, 'ok', error);
    }
};

const amountWithReducedfee = async (amount) => {
    try {
        const data = await ConfigWithdrawModel.findOne({ type:'BANK' });
        console.log(data);
        const vat =  data.fee * data.vat_percent/100;
        const totalFee = data.fee + vat;
        console.log(totalFee);
        const count = amount - totalFee;
        return count;
    } catch (error) {
        return null;
    }
};

const webhookWithdraw = async (req, res) => {
    try {
      const eventData = req.body;
      const { headers } = req;
      console.log('body:', eventData);
      console.log('header:', headers);
      const str = eventData.data.reference_id;
      const parts = str.split('&&');
      const invoice = parts[0];
      const targetDatabase = parts[1];
      const POS = parts[2];
      const withDrawDatabase = await connectTargetDatabase(targetDatabase);
      const Withdraw = withDrawDatabase.model('Withdraw', withdrawSchema);
      console.log(eventData.status);
      let eventStatus;
      if (eventData.event === 'payout.succeeded') {
        eventStatus = 'SUCCEEDED';
      } else if (eventData.event === 'payout.failed') {
        eventStatus = 'FAILED';
      } else if (eventData.event === 'payout.expired') {
        eventStatus = 'EXPIRED';
      } else if (eventData.event === 'payout.refunded') {
        eventStatus = 'REFUNDED';
      }
      const updateResult = await Withdraw.findOneAndUpdate(
        { reference_id: eventData.data.reference_id }, 
        { $set: { status: eventStatus, webhook: eventData } }, 
        { new: true }
      );
      res.status(200).end();
    } catch (error) {
      console.error('Error handling Xendit webhook:', error);
      res.status(500).end();
    }
    };
    const getWithdrawHistory = async (req, res) => {
        try {
            const targetDatabase = req.get('target-database');
            const db = await connectTargetDatabase(targetDatabase);
            const Withdraw = db.model('Withdraw', withdrawSchema);
    
            // const page = parseInt(req.query.page, 10) || 1;
            // const limit = 10;
            // const skip = (page - 1) * limit;
    
            // Mendapatkan parameter query untuk rentang tanggal
            const startDate = req.query.start_date;
            const endDate = req.query.end_date;
    
            // Membuat filter rentang tanggal
            let dateFilter = {};
            if (startDate && endDate) {
                const adjustedEndDate = new Date(endDate);
                adjustedEndDate.setHours(23, 59, 59, 999);
                dateFilter.$and = [
                    { createdAt: { $gte: new Date(startDate), $lte: new Date(adjustedEndDate) } },
                ];
            }
    
    
            // Menghitung total
            // const totalData = await Withdraw.countDocuments(dateFilter);
    
            // Menggunakan limit, skip, dan filter tanggal untuk pagination
            // const response = await Withdraw.find(dateFilter).limit(limit).skip(skip);
                const response = await Withdraw.find(dateFilter).sort({ createdAt: -1 });
            //  total halaman
            // const totalPages = Math.ceil(totalData / limit);
    
            return apiResponseList(
                res,
                200,
                'Sukses',
                response,
                //   totalData,
                //    limit, page
            );
        } catch (err) {
            return apiResponseList(res, 500, 'Error', { error: err.message });
        }
    };
    


    


export default { getBalance, verifyPinWIthdrawl, withdrawl, getWithdrawHistory, webhookWithdraw, withdrawCheckAmount };