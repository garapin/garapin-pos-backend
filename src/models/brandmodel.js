import mongoose from 'mongoose';

const brandSchema = new mongoose.Schema({
  brand: {
    type: String,
    required: true,
    unique: true,
  },
  production: {
    type: String,
    required: true,
  },
  description: String,
  status:{
    type: String,
    default: 'ACTIVE',
  },
}, { timestamps: true });

const BrandModel = mongoose.model('Brand', brandSchema);

export { BrandModel, brandSchema };
