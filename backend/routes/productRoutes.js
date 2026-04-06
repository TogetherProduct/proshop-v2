import express from 'express';
const router = express.Router();
import {
  getProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  createProductReview,
  getTopProducts,
} from '../controllers/productController.js';
import {
  getRecommendations,
  clearRecommendationCache,
  batchGenerateRecommendations,
  getRecommendationStats,
} from '../controllers/recommendationController.js';
import { protect, admin } from '../middleware/authMiddleware.js';
import checkObjectId from '../middleware/checkObjectId.js';

router.route('/').get(getProducts).post(protect, admin, createProduct);
router.get('/top', getTopProducts);

// Recommendations routes
router.get('/recommendations/stats', getRecommendationStats);
router.post('/recommendations/batch', protect, admin, batchGenerateRecommendations);
router.route('/:id/recommendations').get(getRecommendations);
router.delete('/:id/recommendations', protect, admin, clearRecommendationCache);

// Product reviews
router.route('/:id/reviews').post(protect, checkObjectId, createProductReview);
router
  .route('/:id')
  .get(checkObjectId, getProductById)
  .put(protect, admin, checkObjectId, updateProduct)
  .delete(protect, admin, checkObjectId, deleteProduct);

export default router;
