
import { StoreModel, storeSchema } from '../models/storeModel.js';
import { connectTargetDatabase, closeConnection } from '../config/targetDatabase.js';

const getForUserId = async (db) => {
    const database = await connectTargetDatabase(db);
    const storeModel = await database.model('Store', StoreModel.schema).findOne();
    if (!storeModel) {
      return null;
    }
    return storeModel.account_holder.id;
};

export default  getForUserId;