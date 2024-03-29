import mongoose from 'mongoose';

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    sku: {
      type: String,
      required: true,
      unique: true,
    },
    image: {
      type: String,
    },
    icon: {
      type: String,
    },
    discount: {
      type: Number,
      default: 0,
    },
    price: {
      type: Number,
      required: true,
    },
    status:{
      type: String,
      default: 'ACTIVE',
    },
    brand_ref: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Brand', // Reference to the Brand model
      required: true,
    },
    category_ref: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Category', // Reference to the Brand model
        required: true,
    },
    unit_ref: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Unit', // Reference to the Brand model
      required: true,
    },
  },
  { timestamps: true } 
);

const ProductModel = mongoose.model('Product', productSchema);

export { ProductModel, productSchema };
