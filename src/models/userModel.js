import mongoose from 'mongoose';

const databaseSchema = new mongoose.Schema({
  name: {
    type: String,
    required: false, 
  },
  connection_string:  {
    type: String,
    required: false, 
  },
  role:  {
    type: String,
    required: false, 
  },
}, { timestamps: true, autoIndex: false },{ _id: true });

const userSchema = new mongoose.Schema({
  username: {
    type: String, 
    default: null, 
  },
  email: {
    type: String, 
    unique: true,
    validate: {
      validator: async function (value) {
        if (this.isModified('email')) {
          // cek email sudah dipake di database name yang dituju
          const existingUser = await mongoose.models.User.findOne({
            email: value,
            store_database_name: this.store_database_name,
          });
          return !existingUser;
        }
        return true; 
      },
      message: 'Email must be unique within the same store_database_name',
    },
    required: true,
  },
  store_database_name: {
    type: [databaseSchema], 
    default: [], 

  },
  role: String,
  token: String
}, { timestamps: true });

const UserModel = mongoose.model('User', userSchema);

export { UserModel, userSchema };
