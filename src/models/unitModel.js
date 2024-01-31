import mongoose from 'mongoose';

const unitSchema = new mongoose.Schema({
  unit: {
    type: String,
    required: true,
    unique: true,
  },
  description: String,
}, { timestamps: true });

const UnitModel = mongoose.model('Unit', unitSchema);

export { UnitModel, unitSchema };
