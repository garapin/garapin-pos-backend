
import mongoose from 'mongoose';

const StatusBankAccount = Object.freeze({
    ACTIVE: 'ACTIVE',
    INACTIVE: 'INACTIVE',
    PENDING: 'PENDING',
    DECLINE: 'DECLINE'
  });
  const StoreType = Object.freeze({
    MERCHANT: 'MERCHANT',
    USER: 'USER',
    BUSSINESS_PARTNER: 'BUSSINESS_PARTNER'
  });
  const MerchantType = Object.freeze({
    TRX: 'TRX',
    SUPP: 'SUPP',
    CUST: 'CUST',
    NOT_MERCHANT: 'NOT_MERCHANT'
  });
  const StatusStore = Object.freeze({
    ACTIVE: 'ACTIVE',
    INACTIVE: 'INACTIVE',
    PENDING: 'PENDING',
    DECLINE: 'DECLINE'
  });

const storeSchema = new mongoose.Schema({
store_type: {
        type: String,
        enum: Object.values(StoreType),
        default: StoreType.USER
      },
merchant_role: {
        type: String,
        enum: Object.values(MerchantType),
        default: MerchantType.NOT_MERCHANT
      },
id_parent: {
    type: String,
    default: null,
},
store_name:  {
    type: String,
    default: null,
},
store_status:  {
    type: String,
    enum:Object.values(StatusStore), 
    default: StatusStore.ACTIVE,
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
business_partner:{
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
