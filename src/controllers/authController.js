import { UserModel, userSchema } from '../models/userModel.js';
import bcrypt from 'bcrypt';
import { apiResponseList, apiResponse } from '../utils/apiResponseFormat.js';
import { generateToken } from '../utils/jwt.js';
import { StoreModel, storeSchema } from '../models/storeModel.js';
import { connectTargetDatabase } from '../config/targetDatabase.js';

//NOT USE
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await UserModel.findOne({ email });

    if (!user) {
      return apiResponse(res, 400, 'Incorrect email or password');
    }
    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      return apiResponse(res, 400, 'Incorrect email or password.');
    }
    return apiResponse(res, 200, 'Login successful', user);
  } catch (error) {
    console.error('Error:', error);
    return apiResponse(res, 500, 'Internal Server Error');
  }
};

const signinWithGoogle = async (req, res) => {
  try {
    const { email } = req.body;

    const user = await UserModel.findOne({ email });

    if (!user) {
      const newUser = await UserModel({ email });
      const dataUser = await newUser.save();
      const token = generateToken({ data: dataUser._id });
      newUser.token = token;
      newUser.store_database_name.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));


      const result = [];

      for (const db of newUser.store_database_name) {
        console.log(db.name);
        const name = db.name;
        const database = await connectTargetDatabase(db.name);
        const StoreModelDatabase = database.model('Store', storeSchema);
        const data = await StoreModelDatabase.findOne();
        if (data != null) {
          result.push({
            user: newUser,
            dbName: name,
            storesData: data,
            email_owner: email,
            token: token
          });
          console.log(result);
        }

      }
      console.log({ user: newUser, result: result });
      return apiResponse(res, 200, 'Akun berhasil didaftarkan', { user: newUser, database: result });
    }
    user.store_database_name.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    const token = generateToken({ data: user._id });
    user.token = token;

    const result = [];

    for (const db of user.store_database_name) {
      console.log(db.name);
      const name = db.name;
      const database = await connectTargetDatabase(db.name);
      const StoreModelDatabase = database.model('Store', storeSchema);
      const data = await StoreModelDatabase.findOne();
      // if (data != null) {
      result.push({
        user: user,
        dbName: name,
        storesData: data,
        email_owner: email,
        token: token
      });
      console.log(result);
      // }

    }
    console.log({ user: user, result: result });
    return apiResponse(res, 200, 'Akun ditemukan', { user: user, database: result });

  } catch (error) {
    console.error('Error:', error);
    return apiResponse(res, 500, 'Internal Server Error');
  }
};

const logout = (req, res) => {
  res.json({ message: 'Logout successful' });
};

export default { login, logout, signinWithGoogle };
