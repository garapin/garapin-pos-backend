import { ProductModel, productSchema } from '../models/productModel.js';
import { CategoryModel, categorySchema } from '../models/categoryModel.js';
import { UnitModel, unitSchema } from '../models/unitModel.js';
import { BrandModel, brandSchema } from '../models/brandmodel.js';
import { connectTargetDatabase, closeConnection } from '../config/targetDatabase.js';
import { apiResponseList, apiResponse } from '../utils/apiResponseFormat.js';
import saveBase64Image from '../utils/base64ToImage.js';


const createProduct = async (req, res) => {
  try {
    const { name, sku, brand_ref, category_ref, image, unit_ref, discount, price } = req.body;
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
      discount,
      price,  
      brand_ref,
      category_ref,
      unit_ref,
    });
    if (addProduct.image && addProduct.image.startsWith('data:image')) {
      const targetDirectory = 'uploads/products';
      addProduct.image = saveBase64Image(addProduct.image, targetDirectory);
    }

    const savedProduct = await addProduct.save();
    return apiResponse(res, 200, 'Product created successfully', savedProduct);
  } catch (error) {
    console.error('Error creating product:', error);
    return apiResponse(res, 500,'Failed to create product');
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

    const { name, sku, brand_ref, category_ref, iage, unit_ref, discount, price, id } = req.body;


    if (!id) {
      return apiResponse(res, 400, 'Product ID is required');
    }

    const updatedProduct = await ProductModelStore.findByIdAndUpdate(
      id,
      { name, sku, brand_ref, category_ref, iage, unit_ref, discount, price },
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
    const filter = {};


    if (search) {
      filter.$or = [
        { name: { $regex: new RegExp(search, 'i') } },
        { sku: { $regex: new RegExp(search, 'i') } }  
      ];
    }
    
    if(category != "Semua"){
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
  
  
  

export default { createProduct, editProduct, getAllProducts, getSingleProduct };
