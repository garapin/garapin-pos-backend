// userModel.js
import mongoose from 'mongoose';

const databaseSchema = new mongoose.Schema({
  name: String,
  connection_string: String,
  role: String
}, { _id: false });

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
    type: [databaseSchema], // Array of objects based on databaseSchema
    default: [], // Tetapkan nilai default sebagai array kosong
    required: false
  },
  role: String,
}, { timestamps: true });

const UserModel = mongoose.model('User', userSchema);

export { UserModel, userSchema };
