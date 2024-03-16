import 'dotenv/config';

const XENDIT_WEBHOOK_TOKEN = process.env.XENDIT_WEBHOOK_TOKEN;

const verifyXenditToken = (req, res, next) => {
    const webhookToken = req.headers['x-callback-token'];
    const expectedToken = `${XENDIT_WEBHOOK_TOKEN}`;
    if (webhookToken === expectedToken) {
        console.log('Webhook from Xendit is valid');
        next(); 
    } else {
        console.error('Webhook from Xendit is not valid');
        return apiResponse(res, 400, 'token tidak valid');
    }
  };

  export { verifyXenditToken };