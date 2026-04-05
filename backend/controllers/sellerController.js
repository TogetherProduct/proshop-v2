import asyncHandler from "../middleware/asyncHandler.js";
import { AppDataSource } from "../config/sqliteDb.js";
import Seller from "../models/sellerModel.js";

const sellerRepository = AppDataSource.getRepository(Seller);

// @desc    Get all sellers
// @route   GET /api/sellers
// @access  Public
const getSellers = asyncHandler(async (req, res) => {
  const sellers = await sellerRepository.find();
  res.json(sellers);
});

// @desc    Create a new seller
// @route   POST /api/sellers
// @access  Public
const createSeller = asyncHandler(async (req, res) => {
  const { seller_id, seller_zip_code_prefix, seller_city, seller_state } = req.body;

  const newSeller = sellerRepository.create({
    seller_id,
    seller_zip_code_prefix,
    seller_city,
    seller_state
  });

  const savedSeller = await sellerRepository.save(newSeller);
  
  res.status(201).json(savedSeller);
});

export { getSellers, createSeller };