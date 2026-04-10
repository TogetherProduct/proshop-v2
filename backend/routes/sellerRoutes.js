import express from 'express';
const router = express.Router();

import { getSellers, createSeller } from '../controllers/sellerController.js';
import { getSellerForecast } from '../controllers/forecastController.js';

router.route('/').get(getSellers).post(createSeller);
router.route('/:id/forecast').get(getSellerForecast)

export default router;
