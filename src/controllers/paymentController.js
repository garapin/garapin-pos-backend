import axios from 'axios';
import { validationResult } from 'express-validator';
import { apiResponseList, apiResponse } from '../utils/apiResponseFormat.js';
import { connectTargetDatabase } from '../config/targetDatabase.js';
import { ProductModel, productSchema } from '../models/productModel.js';
import { TransactionModel, transactionSchema } from '../models/transactionModel.js';
import { CartModel, cartSchema } from '../models/cartModel.js';
import { StoreModel, storeSchema } from '../models/storeModel.js';
import { PaymentMethodModel, paymentMethodScheme } from '../models/paymentMethodModel.js';
const XENDIT_API_KEY = process.env.XENDIT_API_KEY;
const XENDIT_WEBHOOK_URL = process.env.XENDIT_WEBHOOK_URL;
const currentTime = new Date();
const fifteenMinutesLater = new Date(currentTime.getTime() + 15 * 60000); // 15 minutes later
const fifteenMinutesLaterISOString = fifteenMinutesLater.toISOString();
const createInvoice = async (req, res) => {
  try {

    const targetDatabase = req.get('target-database');
    const timestamp = new Date().getTime();
    const generateInvoice = `INV-${timestamp}`;
    const data = {
      external_id: `${generateInvoice}&&${targetDatabase}&&POS`,
      amount: req.body.amount,
      invoice_label:generateInvoice,
      payer_email: req.body.payer_email,
      description: `Membuat invoice INV-${timestamp}`,
    };
   const response = await saveTransaction(req, req.body.cart_id, data);
      return apiResponse(res, 200, 'Sukses membuat invoice', response);
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
    return apiResponse(res, 400, 'error', response.data);
  }
};



const saveTransaction = async (req, cartId, data) => {
  const targetDatabase = req.get('target-database');
  const storeDatabase = await connectTargetDatabase(targetDatabase);
  const productModelStore = storeDatabase.model('Product', productSchema);
  const cartModelStore = storeDatabase.model('Cart', cartSchema);

  const cart = await cartModelStore.findById(cartId).populate('items.product');
  let totalPrice = 0;

  for (const item of cart.items) {
    const product = await productModelStore.findById(item.product);
    const itemPrice = product.price - product.discount;
    totalPrice += itemPrice * item.quantity;
  }

  cart.total_price = totalPrice;

  const TransactionModelStore = storeDatabase.model('Transaction', transactionSchema);
  const addTransaction = new TransactionModelStore({ product: cart.toObject(), invoice: data.external_id, invoice_label:data.invoice_label, status: 'PENDING' });
 return await addTransaction.save();
  
};

const getInvoices = async (req, res) => {
  try {
    const inv = req.params.id;
    if (inv) {
      console.log(inv);
      const targetDatabase = req.get('target-database');
      if (!targetDatabase) {
        return apiResponse(res, 400, 'Target database is not specified');
      }
      const storeDatabase = await connectTargetDatabase(targetDatabase);
      const TransactionModelStore = storeDatabase.model('Transaction', transactionSchema);
      console.log(inv);
      const invoices = await TransactionModelStore.findOne({ invoice: inv });
      return apiResponse(res, 200, 'Ambil invoices', invoices);
    } else {
      return apiResponse(res, 400, 'Invoices tidak ditemukan');
    }
  } catch (error) {
    console.error('Error:', error.message);
    return apiResponse(res, 400, 'Invoices tidak ditemukan');
  }
};
const cancelInvoices = async (req, res) => {
  try {
    const inv = req.params.id;

    // Jika invoice_number diberikan, lakukan pencarian berdasarkan itu
    if (inv) {
      console.log(inv);
      const targetDatabase = req.get('target-database');
      if (!targetDatabase) {
        return apiResponse(res, 400, 'Target database is not specified');
      }
      const storeDatabase = await connectTargetDatabase(targetDatabase);
      const TransactionModelStore = storeDatabase.model('Transaction', transactionSchema);
      
      console.log(inv);
      const invoices = await TransactionModelStore.findOne({ invoice: inv });
      
      if (invoices) {
        invoices.status = 'CANCELLED';
        await invoices.save();
        return apiResponse(res, 200, 'Order Dibatalkan', invoices);
      } else {
        return apiResponse(res, 404, 'Invoices tidak ditemukan');
      }
    } else {
      return apiResponse(res, 400, 'Invoice tidak ditemukan');
    }
  } catch (error) {
    console.error('Error:', error.message);
    return apiResponse(res, 500, 'Terjadi kesalahan dalam mengambil faktur');
  }
};


const createQrCode = async (req, res) => {
  try {
    const targetDatabase = req.get('target-database');
    const apiKey = XENDIT_API_KEY; 
   
    const data = {
      'reference_id': req.body.reference_id,
      'type': 'DYNAMIC',
      'currency': 'IDR',
      'amount': req.body.amount,
      // "expires_at": fifteenMinutesLaterISOString
  };

    const idXenplatform = req.get('for-user-id');
    const endpoint = 'https://api.xendit.co/qr_codes';

    const headers = {
      'api-version': '2022-07-31',
      'Authorization': `Basic ${Buffer.from(apiKey + ':').toString('base64')}`,
      'for-user-id': idXenplatform,
      // 'webhook-url' : `${XENDIT_WEBHOOK_URL}/webhook/${req.body.reference_id}/${targetDatabase}`
      'webhook-url' : `${XENDIT_WEBHOOK_URL}/webhook/${targetDatabase}`
    };

    const response = await axios.post(endpoint, data, { headers });
      return apiResponse(res, 200, 'Sukses membuat qrcode', response.data);
   
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
    return apiResponse(res, 400, 'error');
  }
};
const createVirtualAccount = async (req, res) => {
  try {
    const targetDatabase = req.get('target-database');
    const apiKey = XENDIT_API_KEY; 
    
    const database = await connectTargetDatabase(targetDatabase);
    const storeModel = await database.model('Store', storeSchema).findOne();
    const transactionModel = database.model('Transaction', transactionSchema);
    const invoces = await transactionModel.findOne({ invoice: req.body.external_id });
    if (invoces == null) {
      return apiResponse(res, 400, 'invoices tidak ditemukan');
    }
    const bankAvailable = await PaymentMethodModel.findOne();
    if (!bankAvailable) {
      return apiResponse(res, 400, 'Tidak ada bank yang tersedia');
    }

    const bankCodes = bankAvailable.available_bank.map(bank => bank.bank);
    if (!bankCodes.includes(req.body.bank_code)) {
      return apiResponse(res, 400, 'Bank tidak terdaftar');
    }
    const data = 
      {
        'external_id': req.body.external_id,
        'bank_code': req.body.bank_code,
        'is_closed': true,
        'expected_amount': invoces.product.total_price,
        'name': storeModel.store_name.substring(0, 12)
      };

    const idXenplatform = req.get('for-user-id');
    const endpoint = 'https://api.xendit.co/callback_virtual_accounts';

    const headers = {
      'Authorization': `Basic ${Buffer.from(apiKey + ':').toString('base64')}`,
      'for-user-id': idXenplatform,
    };

    const response = await axios.post(endpoint, data, { headers });
      return apiResponse(res, 200, 'Sukses membuat qrcode', response.data);
   
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
    return apiResponse(res, 400, 'error');
  }
};

const getQrCode = async (req, res) => {
  try {

    const apiKey = XENDIT_API_KEY; 
    const id = req.params.id;

    const idXenplatform = req.get('for-user-id');
    const endpoint = `https://api.xendit.co/qr_codes/${id}`;

    const headers = {
      'api-version': '2022-07-31',
      'Authorization': `Basic ${Buffer.from(apiKey + ':').toString('base64')}`,
      'for-user-id': idXenplatform,
    };

    const response = await axios.get(endpoint, { headers });
    console.log(response);
      return apiResponse(res, 200, 'Sukses membuat qrcode', response.data);
   
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
    return apiResponse(res, 400, 'error', response.data);
  }
};

//not use
const createEwallet = async (req, res) => {
  try {
    const apiKey = XENDIT_API_KEY; 
    const targetDatabase = req.get('target-database');
    const idXenplatform = req.get('for-user-id');
    
   const  results = await setWebhookXenplatform(req);

    const storeDatabase = await connectTargetDatabase(targetDatabase);
    const TransactionModelStore = storeDatabase.model('Transaction', transactionSchema);
    const invoces = await TransactionModelStore.findOne({ invoice: req.body.reference_id });
   console.log(invoces);
   console.log(invoces.product.total_price);
    const data = {
        'reference_id': req.body.reference_id,
        'currency': 'IDR',
        'amount': invoces.product.total_price,
        'checkout_method': 'ONE_TIME_PAYMENT',
        'channel_code':  req.body.channel_code,
        'channel_properties': {
          'mobile_number': req.body.mobile_phone_customer
      }
                 };
    const endpoint = 'https://api.xendit.co/ewallets/charges';

    const headers = {
      'Authorization': `Basic ${Buffer.from(apiKey + ':').toString('base64')}`,
      'for-user-id': idXenplatform,
//webhook set from api call set callback url xenplatform
};

    const response = await axios.post(endpoint, data, { headers });
      return apiResponse(res, 200, 'Sukses membuat qrcode', response.data);
   
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
    return apiResponse(res, 400, 'error');
  }
};


///not use
const setWebhookXenplatform = async (req) => {
  try {
  const apiKey = XENDIT_API_KEY; 
  const targetDatabase = req.get('target-database');
  const idXenplatform = req.get('for-user-id');
  const data = { 'url': `${XENDIT_WEBHOOK_URL}/webhook/${targetDatabase}`, };

  const endpoint = 'https://api.xendit.co/callback_urls/ewallet';

  const headers = {
    'Authorization': `Basic ${Buffer.from(apiKey + ':').toString('base64')}`,
    'for-user-id': idXenplatform,
//webhook set from api call set callback url xenplatform
};
const response = await axios.post(endpoint, data, { headers });
console.log('ini true');
console.log('ini true');
return true;
} catch (error) {
  console.error('Error:', error.response?.data || error.message);
  return false;
}};

const xenditWebhook = async (req, res) => {
try {
  const eventData = req.body;
  console.log('Received Xendit webhook:', eventData);
  // const inv = req.params.id
  const db = req.params.db;
  const storeDatabase = await connectTargetDatabase(db);
  const TransactionModelStore = storeDatabase.model('Transaction', transactionSchema);
  
  if (eventData.event === 'qr.payment') {
      const paymentData = eventData.data;
      const referenceId = paymentData.reference_id;
      const paymentAmount = paymentData.amount;
      const currency = paymentData.currency;
      const paymentStatus = paymentData.status;
      const updateResult = await TransactionModelStore.findOneAndUpdate(
        { invoice: referenceId }, 
        { $set: { status: paymentStatus, webhook: eventData, payment_method:'QR_QODE', payment_date:  eventData.created } }, 
        { new: true }
      );
  }
  res.status(200).end();
} catch (error) {
  console.error('Error handling Xendit webhook:', error);
  res.status(500).end();
}
};

const webhookVirtualAccount = async (req, res) => {
  try {
    const eventData = req.body;
    const { headers } = req;
    console.log('body:', eventData);
    console.log('header:', headers);
    const { type } = req.params;
    const str = eventData.external_id;
    const parts = str.split('&&');
    const invoice = parts[0];
    const targetDatabase = parts[1];
    const POS = parts[2];

    const storeDatabase = await connectTargetDatabase(targetDatabase);
    const TransactionModelStore = storeDatabase.model('Transaction', transactionSchema);
    console.log(type);
    console.log(eventData.status,);
  if (type === 'CREATED') {
    const updateResult = await TransactionModelStore.findOneAndUpdate(
      { invoice: eventData.external_id }, 
      { $set: { status: eventData.status, webhook: eventData, payment_method:'VIRTUAL_ACCOUNT', payment_date:  eventData.created } }, 
      { new: true }
    );
  } else if (type ==='PAID') {
    const updateResult = await TransactionModelStore.findOneAndUpdate(
      { invoice: eventData.external_id }, 
      { $set: { status: 'SUCCEEDED', webhook: eventData, payment_method:'VIRTUAL_ACCOUNT', payment_date:  eventData.created } }, 
      { new: true }
    );
  }
    res.status(200).end();
  } catch (error) {
    console.error('Error handling Xendit webhook:', error);
    res.status(500).end();
  }
  };
  

//NOT USE
const xenPlatformWebhook = async (req, res) => {
  try {
    const eventData = req.body;
    console.log('Received Xendit webhook:', eventData);
    // const inv = req.params.id
    const { db } = req.params;
    const storeDatabase = await connectTargetDatabase(db);
    const TransactionModelStore = storeDatabase.model('Transaction', transactionSchema);
    const paymentData = eventData.data;
    const referenceId = paymentData.reference_id;
    // const paymentAmount = paymentData.amount;
    // const currency = paymentData.currency;
    const paymentStatus = paymentData.status;
    if (eventData.event === 'qr.payment') {
        const updateResult = await TransactionModelStore.findOneAndUpdate(
        { invoice: referenceId }, 
        { $set: { status: paymentStatus, webhook: eventData, payment_method:'QR', payment_date:  eventData.created } }, 
          { new: true }
        );
    } else if (eventData.event === 'ewallet.capture') {
      const updateResult = await TransactionModelStore.findOneAndUpdate(
        { invoice: referenceId }, 
        { $set: { status: paymentStatus, webhook: eventData, payment_method:'EWALLET', payment_date:  eventData.created } }, 
        { new: true }
      );
    }
    res.status(200).end();
  } catch (error) {
    console.error('Error handling Xendit webhook:', error);
    res.status(500).end();
  }
};
  const paymentAvailable = async (req, res) => {
    const bankAvailable = await PaymentMethodModel.findOne();
    return apiResponse(res, 200, 'bank available', bankAvailable.available_bank);
};
const paymentCash = async (req, res) => {
  const targetDatabase = req.get('target-database');
  const amountPaid = parseInt(req.body.amount);

  const storeDatabase = await connectTargetDatabase(targetDatabase);
  const TransactionModelStore = storeDatabase.model('Transaction', transactionSchema);

  const transaction = await TransactionModelStore.findOne({ invoice: req.body.reference_id });
  if (!transaction) {
      return apiResponse(res, 404, 'Transaksi tidak ditemukan');
  }

     const totalPrice = transaction.product.total_price;

  if (isNaN(amountPaid)) {
    return apiResponse(res, 400, 'Jumlah uang yang dibayarkan harus berupa angka');
  } else if (amountPaid < totalPrice) {
    return apiResponse(res, 400, 'Jumlah uang yang dibayarkan kurang');
  }

  const updateResult = await TransactionModelStore.findOneAndUpdate(
      { invoice: req.body.reference_id }, 
      { 
          $set: { 
              status: 'SUCCEEDED', 
              payment_method: 'CASH', 
              payment_date: new Date(),
              webhook: { amount_paid: amountPaid, total_price: totalPrice, refund:totalPrice - amountPaid }
          } 
      }, 
      { new: true }
  );

  return apiResponse(res, 200, 'Transaksi berhasil diperbarui', { invoice:updateResult, refund:totalPrice - amountPaid });
};




export default { createInvoice, createQrCode, getQrCode, xenditWebhook, getInvoices, cancelInvoices, xenPlatformWebhook, createEwallet, createVirtualAccount, webhookVirtualAccount, paymentAvailable, paymentCash };