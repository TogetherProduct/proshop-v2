import express from 'express';
const router = express.Router();

import { getSellers, createSeller } from '../controllers/sellerController.js';

router.route('/').get(getSellers).post(createSeller);

export default router;
