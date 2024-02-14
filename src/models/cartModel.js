import mongoose from 'mongoose';

const cartItemSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true,
  },
  quantity: {
    type: Number,
    required: true,
    default: 1,
  },
});

const cartSchema = new mongoose.Schema(
  {
    items: [cartItemSchema],
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User', // If you have a User model
    },
  },
  { timestamps: true }
);

const CartModel = mongoose.model('Cart', cartSchema);

export { CartModel, cartSchema };
