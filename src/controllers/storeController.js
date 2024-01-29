import mongoose from '../config/db.js';
import { StoreModel, storeSchema } from '../models/storeModel.js';
import { UserModel, userSchema } from '../models/userModel.js';
import bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid'; // Import uuid

const registerStore = async (req, res) => {
  try {
    const { name, address, username, password, email } = req.body;

    // Hash password before saving it
    const hashedPassword = await bcrypt.hash(password, 10);
    //databasename uniq
      const uniqueId = uuidv4(); // Membuat ID unik dengan uuid
      const storeDatabaseName = `store_${name.replace(/\s+/g, '_')}_${uniqueId}`;
  


    // Simpan data pemilik toko (User) di tabel "users" di database utama
    const newUser = new UserModel({
      username,
      password: hashedPassword,
      email,
      store_database_name: storeDatabaseName, 
      role: "SUPER_ADMIN",
    });

    // Simpan data pengguna (UserModel) di "users" di database utama
    await newUser.save();

    // Buat koneksi untuk database toko dan simpan data di sana
    const storeDatabase = mongoose.createConnection(`mongodb://127.0.0.1:27017/${storeDatabaseName}`, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    const StoreModelInStoreDatabase = storeDatabase.model('Store', storeSchema);

    const storeDataInStoreDatabase = new StoreModelInStoreDatabase({
      name: name,
      address: address
      // Copy other store data fields
    });
   await storeDataInStoreDatabase.save();

    // Tutup koneksi database toko setelah selesai
    storeDatabase.close();

    res.status(200).json({ message: 'Store registration successful', store: newUser });
  } catch (error) {
    console.error('Failed to register store:', error);
    res.status(500).json({ error: 'Failed to register store' });
  }
};



const getStoreInfo = async (req, res) => {
  try {
    // Logika untuk mendapatkan informasi toko
    res.status(200).json({ message: 'Get store information successful', data: {} });
  } catch (error) {
    console.error('Failed to get store information:', error);
    res.status(500).json({ error: 'Failed to get store information' });
  }
};

export default { registerStore, getStoreInfo };
