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
        // Validasi hanya dijalankan jika email diubah
        if (this.isModified('email')) {
          // Mengecek apakah email sudah digunakan dalam store_database_name yang sama
          const existingUser = await mongoose.models.User.findOne({
            email: value,
            store_database_name: this.store_database_name,
          });
          return !existingUser;
        }
        return true; // Return true jika email tidak diubah
      },
      message: 'Email must be unique within the same store_database_name',
    },
    required: true,
  },
  store_database_name: String, 
  role: String,
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now },
  
});

const UserModel = mongoose.model('User', userSchema);

export { UserModel, userSchema };
