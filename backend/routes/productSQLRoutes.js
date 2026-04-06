import express from "express";
import {
  getSqlProducts,
  getSqlProductById,
  createSqlProduct,
  getSqlProductsByIds,
} from "../controllers/productSQLController.js";

const router = express.Router();

// Root route: GET all products or POST a new product
router.route("/")
  .get(getSqlProducts)
  .post(createSqlProduct);

// GET multiple products by IDs (Must come before /:id)
router.route("/by-ids")
  .get(getSqlProductsByIds);

// GET a single product by ID
router.route("/:id")
  .get(getSqlProductById);

export default router;