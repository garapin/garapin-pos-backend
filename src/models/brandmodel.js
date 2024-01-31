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
}, { timestamps: true });

const BrandModel = mongoose.model('Brand', brandSchema);

export { BrandModel, brandSchema };
