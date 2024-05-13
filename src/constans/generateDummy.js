import { connectTargetDatabase } from "../config/targetDatabase.js";
import { rakCategorySchema } from "../models/rakCategoryModel.js";
import { rakTypeSchema } from "../models/rakTypeModel.js";
import { rakPositionSchema } from "../models/rakPositionModel.js";
import { rakSchema } from "../models/rakModel.js";
import mongoose from "mongoose";

export let DATA_RAK = [];
export const generateRakData = async () => {
  try {
    // Buat database baru
    const database = await connectTargetDatabase("om_raku_1_d26e3271-ca2");

    const RakCategoryModel = database.model("RakCategory", rakCategorySchema);

    const RakTypeModel = database.model("rakType", rakTypeSchema);

    const RakPositionModel = database.model("rakPosition", rakPositionSchema);

    const RakModel = database.model("rak", rakSchema);

    const rak = await RakModel.find({}).populate([
      "category_ref",
      "type_ref",
      "position_ref",
    ]);

    if (rak.length > 0) {
      DATA_RAK = rak;
      return;
    }

    // Create Rak Categories
    const category1 = await RakCategoryModel.create({
      category: "Books",
      description: "Category for books",
    });

    const category2 = await RakCategoryModel.create({
      category: "Electronics",
      description: "Category for electronics",
    });

    // Create Rak Types
    const type1 = await RakTypeModel.create({
      nameType: "Type1",
      description: "Type 1 description",
    });

    const type2 = await RakTypeModel.create({
      nameType: "Type2",
      description: "Type 2 description",
    });

    // Create Rak Positions
    const position1 = await RakPositionModel.create({
      nameType: "Position1",
      description: "Position 1 description",
    });

    const position2 = await RakPositionModel.create({
      nameType: "Position2",
      description: "Position 2 description",
    });

    // Create Sample Rak Data with References
    const rak1 = await RakModel.create({
      name: "Bookshelf",
      sku: "BS001",
      price: 200,
      category_ref: category1._id,
      type_ref: type1._id,
      position_ref: position1._id,
    });

    const rak2 = await RakModel.create({
      name: "Laptop Stand",
      sku: "LS001",
      price: 50,
      category_ref: category2._id,
      type_ref: type2._id,
      position_ref: position2._id,
    });
  } catch (error) {
    console.error("Error creating sample data:", error);
  } finally {
    mongoose.disconnect();
  }
};
