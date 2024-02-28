import axios from 'axios';
import { validationResult } from 'express-validator';
import { apiResponseList, apiResponse } from '../utils/apiResponseFormat.js';
import { connectTargetDatabase } from '../config/targetDatabase.js';
import { ProductModel, productSchema } from '../models/productModel.js';
import { TransactionModel, transactionSchema } from '../models/transactionModel.js';
import { CartModel, cartSchema } from '../models/cartModel.js';

const XENDIT_API_KEY = process.env.XENDIT_API_KEY;
const currentTime = new Date();
const fifteenMinutesLater = new Date(currentTime.getTime() + 15 * 60000); // 15 minutes later
const fifteenMinutesLaterISOString = fifteenMinutesLater.toISOString();
const createInvoice = async (req, res) => {
  try {
    // const errors = validationResult(req);
    // if (!errors.isEmpty()) {
    //   return res.status(400).json({ errors: errors.array() });
    // }
    // const apiKey = XENDIT_API_KEY; 
    const timestamp = new Date().getTime();
    const data = {
      external_id: `INV-${timestamp}`,
      amount: req.body.amount,
      payer_email: req.body.payer_email,
      description: `Membuat invoice INV-${timestamp}`,
    };
    

    // const idXenplatform = req.get('for-user-id');
    // const endpoint = 'https://api.xendit.co/v2/invoices';

    // const headers = {
    //   'Authorization': `Basic ${Buffer.from(apiKey + ':').toString('base64')}`,
    //   'for-user-id': idXenplatform,
    // };

    // const response = await axios.post(endpoint, data, { headers });

    // if (response.status === 200) {
   const response = await saveTransaction(req, req.body.cart_id, data);
      return apiResponse(res, 200, "Sukses membuat invoice", response);
    // } else {
    //   return apiResponse(res, 400, "Gagal checkout", response.data);
    // }
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
    return apiResponse(res, 400, "error", response.data);
  }
};



const saveTransaction = async (req,cartId, data) => {
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
  const addTransaction = new TransactionModelStore({ product: cart.toObject(), invoice: data.external_id, status: "PENDING"});
 return await addTransaction.save();
  
};
const getInvoices = async (req, res) => {
  try {
    const inv = req.params.id;

    // Jika invoice_number diberikan, lakukan pencarian berdasarkan itu
    if (inv) {
      console.log(inv)
      const targetDatabase = req.get('target-database');
      if (!targetDatabase) {
        return apiResponse(res, 400, 'Target database is not specified');
      }
      const storeDatabase = await connectTargetDatabase(targetDatabase);
      const TransactionModelStore = storeDatabase.model('Transaction', transactionSchema);
      console.log(inv)
      const invoices = await TransactionModelStore.findOne({ invoice: inv });
      return apiResponse(res, 200, "Ambil invoices", invoices);
    } else {
      return apiResponse(res, 400, "Invoices tidak ditemukan");
    }
  } catch (error) {
    console.error('Error:', error.message);
    return apiResponse(res, 400, "Invoices tidak ditemukan");
  }
}

const createQrCode = async (req, res) => {
  try {
    const targetDatabase = req.get('target-database');
    const apiKey = XENDIT_API_KEY; 
   
    const data = {
      "reference_id": req.body.reference_id,
      "type": "DYNAMIC",
      "currency": "IDR",
      "amount": req.body.amount,
      // "expires_at": fifteenMinutesLaterISOString
  };

    const idXenplatform = req.get('for-user-id');
    const endpoint = 'https://api.xendit.co/qr_codes';

    const headers = {
      'api-version': `2022-07-31`,
      'Authorization': `Basic ${Buffer.from(apiKey + ':').toString('base64')}`,
      'for-user-id': idXenplatform,
      'webhook-url' : `https://4e4d-180-244-163-58.ngrok-free.app/webhook/${req.body.reference_id}/${targetDatabase}`
    };

    const response = await axios.post(endpoint, data, { headers });
      return apiResponse(res, 200, "Sukses membuat qrcode", response.data);
   
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
    return apiResponse(res, 400, "error");
  }
};

const getQrCode = async (req, res) => {
  try {

    const apiKey = XENDIT_API_KEY; 
    const id = req.params.id;

    const idXenplatform = req.get('for-user-id');
    const endpoint = `https://api.xendit.co/qr_codes/${id}`;

    const headers = {
      'api-version': `2022-07-31`,
      'Authorization': `Basic ${Buffer.from(apiKey + ':').toString('base64')}`,
      'for-user-id': idXenplatform,
    };

    const response = await axios.get(endpoint, { headers });
    console.log(response)
      return apiResponse(res, 200, "Sukses membuat qrcode", response.data);
   
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
    return apiResponse(res, 400, "error", response.data);
  }
};



const xenditWebhook = async (req, res) => {
try {
  const eventData = req.body;
  console.log('Received Xendit webhook:', eventData);
  const inv = req.params.id
  const db = req.params.db
  const storeDatabase = await connectTargetDatabase(db);
  const TransactionModelStore = storeDatabase.model('Transaction', transactionSchema);
  
  if (eventData.event === 'qr.payment') {
      const paymentData = eventData.data;
      const referenceId = paymentData.reference_id;
      const paymentAmount = paymentData.amount;
      const currency = paymentData.currency;
      const paymentStatus = paymentData.status;

      const updateResult = await TransactionModelStore.findOneAndUpdate(
        { invoice: inv }, 
        { $set: { status: paymentStatus, webhook: eventData, payment_method:"QR", payment_date:  eventData.created} }, 
        { new: true }
      );
  }
  res.status(200).end();
} catch (error) {
  console.error('Error handling Xendit webhook:', error);
  res.status(500).end();
}
}
export default { createInvoice, createQrCode , getQrCode, xenditWebhook, getInvoices};