import axios from 'axios';
import { validationResult } from 'express-validator';

const createInvoice = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const apiKey = 'xnd_development_JW9hcPFoDMcBKwXZBgABi6JwZ0vgr26CaOM7ADHkhAWWg7bIbkMwrrOsAZ9CO'; // Ganti dengan API key Xendit Anda

    const data = {
      external_id: req.body.external_id,
      amount: req.body.amount,
      payer_email: req.body.payer_email,
      description: req.body.description,
    };

    const endpoint = 'https://api.xendit.co/invoices';



    const headers = {
        'Authorization': `Basic ${Buffer.from(apiKey + ':').toString('base64')}`,
    };
    const response = await axios.post(endpoint, data, { headers });

    res.status(200).json(response.data);
  } catch (error) {

    console.error('Error:', error.response?.data || error.message);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

export default { createInvoice };
