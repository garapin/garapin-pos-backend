import { UserModel, userSchema } from '../models/userModel.js';
import bcrypt from 'bcrypt';
import { apiResponseList, apiResponse } from '../utils/apiResponseFormat.js';
import { generateToken } from '../utils/jwt.js';

//NOT USE
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

    const user = await UserModel.findOne({ email });

    if (!user) {
      const newUser = await UserModel({ email });
      await newUser.save();
      newUser.store_database_name.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      return apiResponse(res, 200, 'Akun berhasil didaftarkan', newUser );
    }
    user.store_database_name.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    const token = generateToken({data: user._id})
    user.token = token
    return apiResponse(res, 200, 'Akun ditemukan', user );
    
  } catch (error) {
    console.error('Error:', error);
    return apiResponse(res, 500, 'Internal Server Error' );
  }
};

const logout = (req, res) => {
  res.json({ message: 'Logout successful' });
};

export default { login, logout, signinWithGoogle };
