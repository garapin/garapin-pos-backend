import { ProductModel, productSchema } from '../models/productModel.js';
import { CategoryModel, categorySchema } from '../models/categoryModel.js';
import { UnitModel, unitSchema } from '../models/unitModel.js';
import { BrandModel, brandSchema } from '../models/brandmodel.js';
import { connectTargetDatabase } from '../config/targetDatabase.js';
import { apiResponseList, apiResponse } from '../utils/apiResponseFormat.js';
import saveBase64Image from '../utils/base64ToImage.js';
import fs from 'fs';
const createProduct = async (req, res) => {
  try {
    const { name, sku, brand_ref, category_ref, image, icon, unit_ref, discount, price } = req.body;
    const targetDatabase = req.get('target-database');

    if (!targetDatabase) {
      return apiResponse(res, 400, 'Target database is not specified');
    }

    const storeDatabase = await connectTargetDatabase(targetDatabase);

    const ProductModelStore = storeDatabase.model('Product', productSchema);

    const existingSku = await ProductModelStore.findOne({ sku });
    if (existingSku) {
      return apiResponse(res, 400, 'SKU already exists');
    }
    const addProduct = new ProductModelStore({
      name,
      sku,
      image,
      icon,
      discount,
      price,
      brand_ref,
      category_ref,
      unit_ref,
    });
    if (addProduct.image && addProduct.image.startsWith('data:image')) {
      const targetDirectory = 'products';
      addProduct.image = saveBase64Image(addProduct.image, targetDirectory, targetDatabase);
    }

    const savedProduct = await addProduct.save();
    return apiResponse(res, 200, 'Product created successfully', savedProduct);
  } catch (error) {
    console.error('Error creating product:', error);
    return apiResponse(res, 500, 'Failed to create product');
  }
};

const editProduct = async (req, res) => {
  try {
    const targetDatabase = req.get('target-database');

    if (!targetDatabase) {
      return apiResponse(res, 400, 'Target database is not specified');
    }

    const storeDatabase = await connectTargetDatabase(targetDatabase);

    const ProductModelStore = storeDatabase.model('Product', productSchema);

    const { name, sku, brand_ref, category_ref, icon, unit_ref, discount, price, id, image } = req.body;

    if (!id) {
      return apiResponse(res, 400, 'Product ID is required');
    }

    const updatedFields = image !== '' ? { name, sku, brand_ref, category_ref, image, icon, unit_ref, discount, price } : { name, sku, brand_ref, category_ref, icon, unit_ref, discount, price };

    if (image && image.startsWith('data:image')) {
      const targetDirectory = 'products';
      const savedImage = saveBase64Image(image, targetDirectory, targetDatabase);
      updatedFields.image = savedImage;
    }

    const updatedProduct = await ProductModelStore.findByIdAndUpdate(
      id,
      updatedFields,
      { new: true }
    );

    if (!updatedProduct) {
      return apiResponse(res, 404, 'Product not found');
    }

    return apiResponse(res, 200, 'Product updated successfully', updatedProduct);
  } catch (error) {
    console.error('Error editing product:', error);
    return apiResponse(res, 500, 'Failed to edit product');
  }
};



// const getAllProducts = async (req, res) => {
//   try {
//     const targetDatabase = req.get('target-database');

//     if (!targetDatabase) {
//       return apiResponseList(res, 400, 'Target database is not specified');
//     }

//     const storeDatabase = await connectTargetDatabase(targetDatabase);


//     // refference brand, category, unit
//     const BrandModel = storeDatabase.model('Brand', brandSchema);
//     const CategoryModel = storeDatabase.model('Category', categorySchema);
//     const UnitModel = storeDatabase.model('Unit', unitSchema);

//     const ProductModelStore = storeDatabase.model('Product', productSchema);


//     const allProducts = await ProductModelStore.find().populate({
//         path: 'brand_ref',
//         model: BrandModel
//       }).populate({
//         path: 'category_ref',
//         model: CategoryModel
//       }).populate({
//         path: 'unit_ref',
//         model: UnitModel
//     });

//     return apiResponseList(res, 200, 'success', allProducts);
//   } catch (error) {
//     console.error('Failed to get all products:', error);
//     return apiResponseList(res, 500, 'Failed to get all products');
//   }
// };

const getAllProducts = async (req, res) => {
  try {
    const targetDatabase = req.get('target-database');

    if (!targetDatabase) {
      return apiResponseList(res, 400, 'Target database is not specified');
    }

    const storeDatabase = await connectTargetDatabase(targetDatabase);


    const BrandModel = storeDatabase.model('Brand', brandSchema);
    const CategoryModel = storeDatabase.model('Category', categorySchema);
    const UnitModel = storeDatabase.model('Unit', unitSchema);
    const ProductModelStore = storeDatabase.model('Product', productSchema);


    const { search, category } = req.query;
    // const filter = {};
    const filter = { status: { $ne: 'DELETED' } };


    if (search) {
      filter.$or = [
        { name: { $regex: new RegExp(search, 'i') } },
        { sku: { $regex: new RegExp(search, 'i') } }
      ];
    }

    if (category != 'Semua') {
      if (category) {
        filter['category_ref'] = category; // Filter berdasarkan ID kategori
      }
    }



    const allProducts = await ProductModelStore.find(filter)
      .populate({
        path: 'brand_ref',
        model: BrandModel
      })
      .populate({
        path: 'category_ref',
        model: CategoryModel
      })
      .populate({
        path: 'unit_ref',
        model: UnitModel
      });

    return apiResponseList(res, 200, 'Success', allProducts);
  } catch (error) {
    // Menangani kesalahan yang mungkin terjadi
    console.error('Failed to get all products:', error);
    return apiResponseList(res, 500, 'Failed to get all products');
  }
};


const getSingleProduct = async (req, res) => {
  try {
    const targetDatabase = req.get('target-database');

    if (!targetDatabase) {
      return apiResponse(res, 400, 'Target database is not specified');
    }

    const storeDatabase = await connectTargetDatabase(targetDatabase);

    // reff
    const BrandModel = storeDatabase.model('Brand', brandSchema);
    const CategoryModel = storeDatabase.model('Category', categorySchema);
    const UnitModel = storeDatabase.model('Unit', unitSchema);

    const ProductModelStore = storeDatabase.model('Product', productSchema);

    const productId = req.params.id;

    //retrrieve ref
    const singleProduct = await ProductModelStore.findById(productId)
      .populate({
        path: 'brand_ref',
        model: BrandModel
      })
      .populate({
        path: 'category_ref',
        model: CategoryModel
      }).populate({
        path: 'unit_ref',
        model: UnitModel
      });

    if (!singleProduct) {
      return apiResponse(res, 400, 'Product not found');
    }

    return apiResponse(res, 200, 'success', singleProduct);
  } catch (error) {
    console.error('Failed to get single product:', error);
    return apiResponse(res, 500, 'Failed to get single product');
  }
};


const getIconProducts = async (req, res) => {
  const folderPath = './assets/icon_products'; // Ganti dengan path folder Anda

  // Baca isi folder
  fs.readdir(folderPath, (err, files) => {
    if (err) {
      console.error('Error reading directory:', err);
      return res.status(500).json({ error: 'Internal Server Error' });
    }

    const filesWithPrefix = files.map(file => `assets/icon_products/${file}`);
    apiResponseList(res, 200, 'success', filesWithPrefix);
  });
};
const deleteProduct = async (req, res) => {
  try {
    const id = req.params.id;
    const targetDatabase = req.get('target-database');

    if (!targetDatabase) {
      return apiResponse(res, 400, 'Target database is not specified');
    }

    const storeDatabase = await connectTargetDatabase(targetDatabase);

    const ProductModelStore = storeDatabase.model('Product', productSchema);

    const product = await ProductModelStore.findById(id);

    if (!product) {
      return apiResponse(res, 404, 'Product not found');
    }
    product.status = 'DELETED';
    await product.save();

    return apiResponse(res, 200, `Sukses hapus produk ${product.name}`);
  } catch (error) {
    console.error('Error deleting product:', error);
    return apiResponse(res, 500, 'Gagal hapus produk');
  }
};




export default { createProduct, editProduct, getAllProducts, getSingleProduct, getIconProducts, deleteProduct };
