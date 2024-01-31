// userModel.js
import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  username: String,
  password: String,
  email: {
    type: String,
    unique: true,
    validate: {
      validator: async function (value) {
        if (this.isModified('email')) {
          // Mengecek apakah email sudah digunakan dalam store_database_name yang sama
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
  store_database_name: String, 
  role: String,
}, { timestamps: true });

const UserModel = mongoose.model('User', userSchema);

export { UserModel, userSchema };
