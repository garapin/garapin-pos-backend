import { UserModel, userSchema } from '../models/userModel.js';
import bcrypt from 'bcrypt';
import { apiResponseList, apiResponse } from '../utils/apiResponseFormat.js';

const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await UserModel.findOne({ email });

    if (!user) {
        return apiResponse(res, 400, 'Incorrect email or password.' );
    }
    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
       return apiResponse(res, 400, 'Incorrect email or password.' );
    }
    return apiResponse(res, 200, 'Login successful', user );
  } catch (error) {
    console.error('Error:', error);
    return apiResponse(res, 500, 'Internal Server Error' );
  }
};

const signinWithGoogle = async (req, res) => {
  try {
    const { email } = req.body;

    // Cari pengguna berdasarkan email
    const user = await UserModel.findOne({ email });

    if (!user) {
      // Jika email belum terdaftar, daftarkan pengguna
      const newUser = new UserModel({ email });
      await newUser.save();

      // Kembalikan data pengguna baru
      return apiResponse(res, 200, 'Akun berhasil didaftarkan', newUser );
    }

    // Jika email sudah terdaftar, kembalikan data pengguna
    return apiResponse(res, 200, 'Akun ditemukan', user );
    
  } catch (error) {
    console.error('Error:', error);
    // Tanggapi kesalahan internal server
    return apiResponse(res, 500, 'Internal Server Error' );
  }
};

const logout = (req, res) => {
  res.json({ message: 'Logout successful' });
};

export default { login, logout, signinWithGoogle };
