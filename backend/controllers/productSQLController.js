import asyncHandler from "../middleware/asyncHandler.js";
import { AppDataSource } from "../config/sqliteDb.js";
import SqlProduct from "../models/productSQLModel.js";
import { Like, In } from "typeorm"; 

const sqlProductRepository = AppDataSource.getRepository(SqlProduct);

// @desc    Get all SQL products with pagination and keyword search
// @route   GET /api/sql-products
// @access  Public
const getSqlProducts = asyncHandler(async (req, res) => {
  const pageSize = 10; 
  const page = Number(req.query.pageNumber) || 1;

  const keyword = req.query.keyword ? req.query.keyword : "";
  const whereClause = keyword 
    ? { product_name: Like(`%${keyword}%`) } 
    : {};

  // findAndCount returns an array: [array_of_results, total_count]
  const [products, count] = await sqlProductRepository.findAndCount({
    where: whereClause,
    take: pageSize,                 // Equivalent to .limit() in Mongoose
    skip: pageSize * (page - 1),    // Equivalent to .skip() in Mongoose
  });

  res.json({ 
    products, 
    page, 
    pages: Math.ceil(count / pageSize) 
  });
});

// @desc    Get multiple SQL products by an array of IDs
// @route   GET /api/sql-products/by-ids?ids=id1,id2,id3
// @access  Public
const getSqlProductsByIds = asyncHandler(async (req, res) => {
  const idsQuery = req.query.ids;

  // If no IDs are provided, return an empty array
  if (!idsQuery) {
    return res.status(400).json({ message: "No product IDs provided" });
  }

  // Convert the comma-separated string from the URL into an array
  const idsArray = idsQuery.split(",");

  const products = await sqlProductRepository.find({
    where: {
      product_id: In(idsArray),
    },
  });

  res.json(products);
});

// @desc    Get single SQL product by ID
// @route   GET /api/sql-products/:id
// @access  Public
const getSqlProductById = asyncHandler(async (req, res) => {
  const product = await sqlProductRepository.findOne({
    where: { product_id: req.params.id }
  });

  if (product) {
    res.json(product);
  } else {
    res.status(404);
    throw new Error("Product not found in SQLite database");
  }
});

// @desc    Create a new SQL product
// @route   POST /api/sql-products
// @access  Private/Admin
const createSqlProduct = asyncHandler(async (req, res) => {
  const {
    product_id,
    product_category_name,
    product_name_lenght,
    product_description_lenght,
    product_photos_qty,
    product_weight_g,
    product_length_cm,
    product_height_cm,
    product_width_cm,
    price,
    product_name,
    image_url
  } = req.body;

  const newProduct = sqlProductRepository.create({
    product_id,
    product_category_name,
    product_name_lenght,
    product_description_lenght,
    product_photos_qty,
    product_weight_g,
    product_length_cm,
    product_height_cm,
    product_width_cm,
    price,
    product_name,
    image_url
  });

  const savedProduct = await sqlProductRepository.save(newProduct);
  res.status(201).json(savedProduct);
});

export { getSqlProducts, getSqlProductById, createSqlProduct, getSqlProductsByIds };