import mongoose from 'mongoose';

const paymentMethodScheme = new mongoose.Schema({
  available_bank: [{
    bank: {
      type: String,
      required: true
    },
    image: {
      type: String,
      required: true
    }
  }]
});

const PaymentMethodModel = mongoose.model('Payment', paymentMethodScheme);

export { PaymentMethodModel, paymentMethodScheme };
