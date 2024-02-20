
import mongoose from 'mongoose';

const storeSchema = new mongoose.Schema({
store_name:  {
    type: String,
    required: null,
},
pic_name: {
    type: String,
    default: null, 
},
phone_number: {
    type: String,
    required: null,
},
address: {
  type: String,
  default: null, 
},
state: {
    type: String,
    default: null, 
  },
city: {
    type: String,
    default: null, 
},
country: {
    type: String,
    default: null, 
},
postal_code: {
    type: String,
    default: null, 
},
store_image: {
    type: String, 
    default: null, 
},
}, { timestamps: true } );

const StoreModel = mongoose.model('Store', storeSchema);

export { StoreModel, storeSchema };
