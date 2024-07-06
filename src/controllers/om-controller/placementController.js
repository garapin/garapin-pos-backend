import { exists } from "xendit-node";
import { connectTargetDatabase } from "../../config/targetDatabase.js";
import { categorySchema } from "../../models/categoryModel.js";
import { placementSchema } from "../../models/placementModel.js";
import { positionSchema } from "../../models/positionModel.js";
import { productSchema } from "../../models/productModel.js";
import { rakSchema } from "../../models/rakModel.js";
import { rakTypeSchema } from "../../models/rakTypeModel.js";
import { rentSchema } from "../../models/rentModel.js";
import { sendResponse } from "../../utils/apiResponseFormat.js";
import { brandSchema } from "../../models/brandmodel.js";
import { unitSchema } from "../../models/unitModel.js";

const addProductToRak = async (req, res) => {
  const { rent_id, list_product } = req?.body;
  const targetDatabase = req.get("target-database");

  if (!targetDatabase) {
    return sendResponse(res, 400, "Target database is not specified", null);
  }

  const storeDatabase = await connectTargetDatabase(targetDatabase);

  const targetDatabaseSupplier = req.get("target-database-supplier");

  if (!targetDatabaseSupplier) {
    return sendResponse(
      res,
      400,
      "Target database supplier is not specified",
      null
    );
  }

  const storeDatabaseSupplier = await connectTargetDatabase(
    targetDatabaseSupplier
  );

  try {
    const RentModelStore = storeDatabase.model("rent", rentSchema);
    const PlacementModel = storeDatabase.model("Placement", placementSchema);
    const rakModelStore = storeDatabase.model("rak", rakSchema);
    const categoryModelStore = storeDatabase.model("Category", categorySchema);
    const BrandModel = storeDatabase.model("Brand", brandSchema);
    const UnitModel = storeDatabase.model("Unit", unitSchema);
    const typeModelStore = storeDatabase.model("rakType", rakTypeSchema);
    const positionModelStore = storeDatabase.model("position", positionSchema);
    const ProductModel = storeDatabase.model("Product", productSchema);
    const ProductModelSupplier = storeDatabaseSupplier.model(
      "Product",
      productSchema
    );
    const categoryModelStoreSupplier = storeDatabaseSupplier.model(
      "Category",
      categorySchema
    );
    const BrandModelSupplier = storeDatabaseSupplier.model(
      "Brand",
      brandSchema
    );
    const UnitModelSupplier = storeDatabaseSupplier.model("Unit", unitSchema);

    const detail_list_product = [];
    const listError = [];
    const listNew = [];
    const listNewProduct = [];
    for (const list of list_product) {
      const productPOS = await ProductModelSupplier.findOne({
        _id: list.product.toString(),
      }).populate(["category_ref", "brand_ref", "unit_ref"]);

      let Category = await categoryModelStore.findOne({
        category: { $regex: productPOS.category_ref.category, $options: "i" },
      });

      if (!Category) {
        const newCategory = await categoryModelStore.create({
          category: productPOS.category_ref.category,
          description: productPOS.category_ref.description,
        });
        Category = newCategory;
        listNew.push(newCategory);
      }

      let Brand = await BrandModel.findOne({
        brand: { $regex: productPOS.brand_ref.brand, $options: "i" },
      });

      if (!Brand) {
        const newBrand = await BrandModel.create({
          brand: productPOS.brand_ref.brand,
          description: productPOS.brand_ref.description,
          production: productPOS.brand_ref.production,
        });
        Brand = newBrand;
        listNew.push(newBrand);
      }

      let Unit = await UnitModel.findOne({
        unit: { $regex: productPOS.unit_ref.unit, $options: "i" },
      });

      if (!Unit) {
        const newUnit = await UnitModel.create({
          unit: productPOS.unit_ref.unit,
          description: productPOS.unit_ref.description,
        });
        Unit = newUnit;
        listNew.push(newUnit);
      }

      const existingSku = await ProductModel.findOne({ sku: productPOS.sku });

      if (!existingSku) {
        const existingProduct = await ProductModelSupplier.findOne({
          _id: list.product.toString(),
        });

        const newProduct = await ProductModel.create({
          ...existingProduct,
          _id: existingProduct._id,
          category_ref: Category.id,
          brand_ref: Brand.id,
          unit_ref: Unit.id,
          price: existingProduct.price,
          sku: existingProduct.sku,
          name: existingProduct.name,
          stock: list.stock,
          product_supplier_id: existingProduct.id,
        });

        await existingProduct.addStock(
          list.stock,
          targetDatabaseSupplier,
          `Menambahkan product ke dalam rak`
        );

        listNew.push({ newProduct, existingProduct });
        listNewProduct.push({
          product: newProduct.id,
          stock: list.stock,
        });
      }

      if (productPOS) {
        detail_list_product.push(productPOS);
      }
    }
    // Query untuk mendapatkan semua transaksi yang dibuat oleh user tertentu dan mengumpulkan rak_id dan position_id
    const rentExist = await RentModelStore.findOne({
      _id: rent_id,
    }).populate(["rak", "position", "list_product.product"]);

    if (!rentExist) {
      return sendResponse(res, 400, "Rent not found", null);
    }
    // console.log({ filter: rentExist.list_product[0] });
    let messageProduct = null;
    for (const list of listNewProduct) {
      const productCheck = await ProductModel.findOne({
        _id: list.product,
      }).populate(["category_ref"]);

      if (
        rentExist.position.filter.includes(
          productCheck.category_ref.id.toString()
        )
      ) {
        messageProduct = `Category ${productCheck.category_ref.category} product ${productCheck.name} cannot to place!`;
      }
    }

    if (messageProduct) {
      return sendResponse(res, 400, messageProduct, null);
    }

    // const placement = await PlacementModel.create({
    //   rent: rent_id,
    //   create_by: create_by,
    //   product: product_id,
    // });

    rentExist.list_product = list_product;

    await rentExist.save();

    const rent = await RentModelStore.findOne({
      _id: rent_id,
    }).populate(["rak", "position", "list_product.product"]);

    return sendResponse(res, 200, "Add product to rak successfully", {
      rent,
      // detail_list_product,
      // listError,
      listNew,
    });
  } catch (error) {
    console.error("Error getting Get all rent:", error);
    return sendResponse(res, 500, "Internal Server Error", {
      error: error.message,
    });
  }
};

const getAllPlacementByUser = async (req, res) => {
  const params = req?.query;
  try {
    if (!params.db_user) {
      return sendResponse(res, 400, "Params db_user not found", null);
    }
    const targetDatabase = req.get("target-database");

    if (!targetDatabase) {
      return sendResponse(res, 400, "Target database is not specified", null);
    }

    const storeDatabase = await connectTargetDatabase(targetDatabase);
    const RentModelStore = storeDatabase.model("rent", rentSchema);
    const PlacementModel = storeDatabase.model("Placement", placementSchema);
    const rakModelStore = storeDatabase.model("rak", rakSchema);
    const categoryModelStore = storeDatabase.model("Category", categorySchema);
    const typeModelStore = storeDatabase.model("rakType", rakTypeSchema);
    const positionModelStore = storeDatabase.model("position", positionSchema);
    const ProductModel = storeDatabase.model("Product", productSchema);

    const rent = await RentModelStore.find({
      db_user: params.db_user,
      // product: { $ne: null },
    }).populate(["rak", "position", "list_product.product"]);

    if (!rent) {
      return sendResponse(
        res,
        400,
        "List of products that have been placed not found",
        null
      );
    }

    return sendResponse(
      res,
      200,
      "List of products that have been placed successfully",
      rent
    );
  } catch (error) {
    console.error("Error getting Get all rent:", error);
    return sendResponse(res, 500, "Internal Server Error", {
      error: error.message,
    });
  }
};

const getAllPlacement = async (req, res) => {
  try {
    const targetDatabase = req.get("target-database");

    if (!targetDatabase) {
      return sendResponse(res, 400, "Target database is not specified", null);
    }

    const storeDatabase = await connectTargetDatabase(targetDatabase);
    const RentModelStore = storeDatabase.model("rent", rentSchema);
    const PlacementModel = storeDatabase.model("Placement", placementSchema);
    const rakModelStore = storeDatabase.model("rak", rakSchema);
    const categoryModelStore = storeDatabase.model("Category", categorySchema);
    const typeModelStore = storeDatabase.model("rakType", rakTypeSchema);
    const positionModelStore = storeDatabase.model("position", positionSchema);
    const ProductModel = storeDatabase.model("Product", productSchema);

    const rent = await RentModelStore.find({}).populate([
      "rak",
      "position",
      "list_product.product",
    ]);

    if (!rent || rent.length < 1) {
      return sendResponse(
        res,
        400,
        "List of products that have been placed not found",
        null
      );
    }

    const filterRent = rent?.filter((item) => item.position.status === "RENT");

    return sendResponse(
      res,
      200,
      "List of products that have been placed successfully",
      filterRent
    );
  } catch (error) {
    console.error("Error getting Get all rent:", error);
    return sendResponse(res, 500, "Internal Server Error", {
      error: error.message,
    });
  }
};

export default {
  addProductToRak,
  getAllPlacementByUser,
  getAllPlacement,
};
