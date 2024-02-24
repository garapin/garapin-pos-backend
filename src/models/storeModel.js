
import mongoose from 'mongoose';

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
}, { timestamps: true } );

const StoreModel = mongoose.model('Store', storeSchema);

export { StoreModel, storeSchema };
