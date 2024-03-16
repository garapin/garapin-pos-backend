
import mongoose from 'mongoose';

const StatusBankAccount = Object.freeze({
    ACTIVE: 'ACTIVE',
    INACTIVE: 'INACTIVE',
    PENDING: 'PENDING'
  });

const storeSchema = new mongoose.Schema({
store_name:  {
    type: String,
    default: null,
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

bank_account:{
bank_name:{
    type: String,
    default:null
},  
holder_name:{
    type: String,
    default:null
},
account_number:{
    type: Number,
    default: null
},
pin:{
    type: Number,
    default: null
},
company_name:{
    type: String,
    default: null
},
no_npwp:{
    type: String,
    default: null
},
no_nib:{
    type: String,
    default: null
},
image_npwp:{
    type: String,
    default: null
},
image_nib:{
    type: String,
    default: null
},
image_akta:{
    type: String,
    default: null
},
image_akta:{
    type: String,
    default: null
},
status: {
    type: String,
    enum: Object.values(StatusBankAccount),
    default: StatusBankAccount.INACTIVE
  }
},
account_holder: {
    id: {
        type: String,
        default: null, 
    },
    created: {
        type: Date,
        default: null, 
    },
    updated: {
        type: Date,
        default: null, 
    },
    email: {
        type: String,
        default: null, 
    },
    type: {
        type: String,
        default: null, 
    },
    public_profile: {
        business_name: {
            type: String,
            default: null, 
        },
    },
    country: {
        type: String,
        default: null, 
    },
    status: {
        type: String,
        default: null, 
    }
}
}, { timestamps: true });

const StoreModel = mongoose.model('Store', storeSchema);

export { StoreModel, storeSchema };
