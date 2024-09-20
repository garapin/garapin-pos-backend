import { ProductModel, productSchema } from "../../models/productModel.js";
import { CategoryModel, categorySchema } from "../../models/categoryModel.js";
import { UnitModel, unitSchema } from "../../models/unitModel.js";
import { BrandModel, brandSchema } from "../../models/brandmodel.js";
import { connectTargetDatabase } from "../../config/targetDatabase.js";
import { apiResponseList, apiResponse } from "../../utils/apiResponseFormat.js";
import saveBase64Image, {
  saveBase64ImageWithAsync,
} from "../../utils/base64ToImage.js";
import fs from "fs";
import { stockHistorySchema } from "../../models/stockHistoryModel.js";
import { getDatabase } from "firebase-admin/database";
import { DatabaseModel } from "../../models/databaseModel.js";

const createProduct = async (req, res) => {
  const {
    name,
    sku,
    brand_ref,
    category_ref,
    image,
    icon,
    unit_ref,
    discount,
    price,
    stock,
    expired_date,
    length,
    width,
    db_user,
  } = req.body;

  const targetDatabaseSupplier = req.get("target-database-supplier");

  if (!targetDatabaseSupplier) {
    return apiResponse(res, 400, "Target database is not specified");
  }

  const storeDatabase = await connectTargetDatabase(targetDatabaseSupplier);

  try {
    const ProductModelStore = storeDatabase.model("Product", productSchema);
    const CategoryModelStore = storeDatabase.model("Category", categorySchema);
    const BrandModelStore = storeDatabase.model("Brand", brandSchema);
    const UnitModelStore = storeDatabase.model("Unit", unitSchema);

    const CategoryModel = await CategoryModelStore.findOne({
      _id: category_ref,
    });

    if (!CategoryModel) {
      return apiResponse(res, 400, "Category by id not found");
    }

    const BrandModel = await BrandModelStore.findOne({
      _id: brand_ref,
    });

    if (!BrandModel) {
      return apiResponse(res, 400, "Brand by id not found");
    }

    const UnitModel = await UnitModelStore.findOne({
      _id: unit_ref,
    });

    if (!UnitModel) {
      return apiResponse(res, 400, "Unit by id not found");
    }

    // const existingSku = await ProductModelStore.findOne({ sku });

    // if (existingSku) {
    //   return apiResponse(res, 400, "SKU already exists");
    // }
    const addProduct = new ProductModelStore({
      name,
      sku,
      image,
      icon,
      discount,
      price,
      stock: 0,
      brand_ref,
      category_ref,
      unit_ref,
      expired_date,
      length,
      width,
      db_user,
    });
    if (addProduct.image && addProduct.image.startsWith("data:image")) {
      const targetDirectory = "products";
      addProduct.image = saveBase64Image(
        addProduct.image,
        targetDirectory,
        targetDatabaseSupplier
      );
    }

    const savedProduct = await addProduct.save();

    // await savedProduct.addStock(
    //   stock,
    //   targetDatabaseSupplier,
    //   "Create Product"
    // );

    return apiResponse(res, 200, "Product created successfully", savedProduct);
  } catch (error) {
    console.error("Error creating product:", error);
    return apiResponse(res, 500, "Failed to create product");
  }
};

const editProduct = async (req, res) => {
  const {
    id,
    name,
    sku,
    brand_ref,
    category_ref,
    image,
    icon,
    unit_ref,
    discount,
    price,
    stock,
    minimum_stock,
    expired_date,
    length,
    width,
    db_user,
  } = req.body;
  const targetDatabase = req.get("target-database");

  if (!targetDatabase) {
    return apiResponse(res, 400, "Target database is not specified");
  }

  const storeDatabase = await connectTargetDatabase(targetDatabase);

  try {
    const ProductModelStore = storeDatabase.model("Product", productSchema);

    const product = await ProductModelStore.findOne({
      _id: id,
    });

    if (!product) {
      return apiResponse(res, 404, "Product not found");
    }

    // Check if the new SKU already exists
    if (sku) {
      // Only validate SKU uniqueness if the SKU is changed
      if (product.sku !== sku) {
        const existingProduct = await ProductModelStore.findOne({ sku });
        if (existingProduct) {
          return apiResponse(res, 400, "SKU must be unique");
        }
      }
    }

    let imagePath = "";
    if (image) {
      if (!image.startsWith("data:image")) {
        return sendResponse(
          res,
          400,
          "Image format must be start with data:image ",
          null
        );
      }
      // Jika store_image dikirim dan tidak kosong, simpan gambar
      if (image.startsWith("data:image")) {
        const targetDirectory = "products";
        imagePath = await saveBase64ImageWithAsync(
          image,
          targetDirectory,
          targetDatabase,
          product?.image !== "" ? product?.image.split("\\")[3] : null
        );
      }
    }

    product.name = name;
    product.image = imagePath === "" ? product.image : imagePath;
    product.sku = sku;
    product.brand_ref = brand_ref;
    product.category_ref = category_ref;
    product.unit_ref = unit_ref;
    product.icon = icon;
    product.discount = discount;
    product.price = price;
    product.minimum_stock = minimum_stock;
    product.expired_date = expired_date;
    product.length = length;
    product.width = width;
    product.db_user = db_user;

    // if (product.stock > stock) {
    //   const stockNew = product.stock - stock;
    //   await product.subtractStock(stockNew, targetDatabase, "Edit Stock");
    // } else {
    //   const stockNew = stock - product.stock;

    //   await product.addStock(stockNew, targetDatabase, "Edit Stock");
    // }

    await product.save();

    // Simpan perubahan ke semua database
    const allDatabases = await DatabaseModel.find();
    const updatePromises = allDatabases.map(async (dbName) => {
      const db = await connectTargetDatabase(dbName.db_name);

      try {
        const ProductModel = db.model("Product", productSchema);

        await ProductModel.updateMany(
          { inventory_id: id },
          {
            $set: {
              name: name,
              image: imagePath === "" ? product.image : imagePath,
              sku: sku,
              brand_ref: brand_ref,
              category_ref: category_ref,
              unit_ref: unit_ref,
              icon: icon,
              discount: discount,
              price: price,
              minimum_stock: minimum_stock,
              expired_date: expired_date,
              length: length,
              width: width,
            },
          }
        );
      } finally {
        await db.close();
      }
    });

    await Promise.all(updatePromises);

    return apiResponse(res, 200, "Product updated successfully", product);
  } catch (error) {
    console.error("Error editing product:", error);
    return apiResponse(res, 500, "Failed to edit product");
  }
};

const getAllProducts = async (req, res) => {
  const targetDatabase = req.get("target-database");

  if (!targetDatabase) {
    return apiResponseList(res, 400, "Target database is not specified");
  }

  const storeDatabase = await connectTargetDatabase(targetDatabase);

  try {
    const BrandModel = storeDatabase.model("Brand", brandSchema);
    const CategoryModel = storeDatabase.model("Category", categorySchema);
    const UnitModel = storeDatabase.model("Unit", unitSchema);
    const ProductModelStore = storeDatabase.model("Product", productSchema);

    const { search, category } = req.query;
    // const filter = {};
    const filter = { status: { $ne: "DELETED" } };

    // if (!db_user) {
    //   return apiResponseList(
    //     res,
    //     400,
    //     "Param db_user / supplider db is not found"
    //   );
    // }

    if (search) {
      filter.$or = [
        { name: { $regex: new RegExp(search, "i") } },
        { sku: { $regex: new RegExp(search, "i") } },
      ];
    }

    if (category != "Semua") {
      if (category) {
        filter["category_ref"] = category; // Filter berdasarkan ID kategori
      }
    }

    // filter["db_user"] = db_user;

    const allProducts = await ProductModelStore.find(filter)
      .populate({
        path: "brand_ref",
        model: BrandModel,
      })
      .populate({
        path: "category_ref",
        model: CategoryModel,
      })
      .populate({
        path: "unit_ref",
        model: UnitModel,
      });

    return apiResponseList(res, 200, "Success", allProducts);
  } catch (error) {
    // Menangani kesalahan yang mungkin terjadi
    console.error("Failed to get all products:", error);
    return apiResponseList(res, 500, "Failed to get all products");
  }
};

const getSingleProduct = async (req, res) => {
  const targetDatabase = req.get("target-database");
  console.log(targetDatabase);

  if (!targetDatabase) {
    return apiResponse(res, 400, "Target database is not specified");
  }

  const storeDatabase = await connectTargetDatabase(targetDatabase);
  try {
    // reff
    const BrandModel = storeDatabase.model("Brand", brandSchema);
    const CategoryModel = storeDatabase.model("Category", categorySchema);
    const UnitModel = storeDatabase.model("Unit", unitSchema);

    const ProductModelStore = storeDatabase.model("Product", productSchema);

    const productId = req.params.id;

    if (!productId) {
      return apiResponse(res, 400, "params id not found");
    }

    //retrrieve ref
    const singleProduct = await ProductModelStore.findOne({
      _id: productId,
    })
      .populate({
        path: "brand_ref",
        model: BrandModel,
      })
      .populate({
        path: "category_ref",
        model: CategoryModel,
      })
      .populate({
        path: "unit_ref",
        model: UnitModel,
      });

    if (!singleProduct) {
      return apiResponse(res, 400, "Product not found");
    }

    if (singleProduct.status == "DELETED") {
      return apiResponse(res, 204, "Product was deleted");
    }

    return apiResponse(res, 200, "success", singleProduct);
  } catch (error) {
    console.error("Failed to get single product:", error);
    return apiResponse(res, 500, "Failed to get single product");
  }
};

const getStockHistorySingleProduct = async (req, res) => {
  const targetDatabase = req.get("target-database");

  if (!targetDatabase) {
    return apiResponse(res, 400, "Target database is not specified");
  }

  const storeDatabase = await connectTargetDatabase(targetDatabase);

  try {
    // reff
    const BrandModel = storeDatabase.model("Brand", brandSchema);
    const CategoryModel = storeDatabase.model("Category", categorySchema);
    const UnitModel = storeDatabase.model("Unit", unitSchema);

    const ProductModelStore = storeDatabase.model("Product", productSchema);

    const productId = req.params.id;

    if (!productId) {
      return apiResponse(res, 400, "params id not found");
    }

    const StockHistoryModel = storeDatabase.model(
      "StockHistory",
      stockHistorySchema
    );

    //retrrieve ref
    const singleHistoryStock = await StockHistoryModel.find({
      product: productId,
    })
      .sort({ date: -1 })
      .populate({
        path: "product",
        populate: [
          { path: "category_ref" },
          { path: "brand_ref" },
          { path: "unit_ref" },
        ],
      });

    if (!singleHistoryStock) {
      return apiResponse(res, 400, "Product not found");
    }

    return apiResponse(
      res,
      200,
      "Get single stock history successfully",
      singleHistoryStock
    );
  } catch (error) {
    console.error("Failed to get single product:", error);
    return apiResponse(res, 500, "Failed to get single product");
  }
};

const getStockHistory = async (req, res) => {
  const targetDatabase = req.get("target-database");

  if (!targetDatabase) {
    return apiResponse(res, 400, "Target database is not specified");
  }

  const storeDatabase = await connectTargetDatabase(targetDatabase);

  try {
    // reff
    const BrandModel = storeDatabase.model("Brand", brandSchema);
    const CategoryModel = storeDatabase.model("Category", categorySchema);
    const UnitModel = storeDatabase.model("Unit", unitSchema);

    const ProductModelStore = storeDatabase.model("Product", productSchema);

    const StockHistoryModel = storeDatabase.model(
      "StockHistory",
      stockHistorySchema
    );

    //retrrieve ref
    const allHistoryStock = await StockHistoryModel.find()
      .sort({ date: -1 })
      .populate({
        path: "product",
        populate: [
          { path: "category_ref" },
          { path: "brand_ref" },
          { path: "unit_ref" },
        ],
      });

    if (!allHistoryStock) {
      return apiResponse(res, 400, "Stock history not found");
    }

    return apiResponse(
      res,
      200,
      "Get all stock history successfully",
      allHistoryStock
    );
  } catch (error) {
    console.error("Failed to get single product:", error);
    return apiResponse(res, 500, "Failed to get single product");
  }
};

const getIconProducts = async (req, res) => {
  const folderPath = "./assets/icon_products"; // Ganti dengan path folder Anda

  // Baca isi folder
  fs.readdir(folderPath, (err, files) => {
    if (err) {
      console.error("Error reading directory:", err);
      return res.status(500).json({ error: "Internal Server Error" });
    }

    const filesWithPrefix = files.map((file) => `assets/icon_products/${file}`);
    apiResponseList(res, 200, "success", filesWithPrefix);
  });
};
const deleteProduct = async (req, res) => {
  const targetDatabase = req.get("target-database");

  if (!targetDatabase) {
    return apiResponse(res, 400, "Target database is not specified");
  }

  const storeDatabase = await connectTargetDatabase(targetDatabase);

  try {
    const id = req.params.id;

    const ProductModelStore = storeDatabase.model("Product", productSchema);

    const product = await ProductModelStore.findById(id);

    if (!product) {
      return apiResponse(res, 404, "Product not found");
    }
    product.status = "DELETED";
    await product.save();

    return apiResponse(res, 200, `Sukses hapus produk ${product.name}`);
  } catch (error) {
    console.error("Error deleting product:", error);
    return apiResponse(res, 500, "Gagal hapus produk");
  }
};

export default {
  createProduct,
  editProduct,
  getAllProducts,
  getSingleProduct,
  getIconProducts,
  deleteProduct,
  getStockHistorySingleProduct,
  getStockHistory,
  // getSellStockHistory,
};
