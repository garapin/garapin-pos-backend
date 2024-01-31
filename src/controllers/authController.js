// AuthController.js
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

const checkEmail = async (req, res) => {
    try {
        const { email } = req.body;
    
        const user = await UserModel.findOne({ email });
        if (!user) {
          return res.status(400).json(apiResponse( 400, 'Akun tidak ditemukan', user ));
        }
        return apiResponse(res, 200, 'Email valid', user );
      } catch (error) {
        console.error('Error:', error);
        return apiResponse(res, 500, 'Internal Server Error' );
      }
}

const logout = (req, res) => {
  res.json({ message: 'Logout successful' });
};

export default { login, logout, checkEmail };
