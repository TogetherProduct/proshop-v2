import express from 'express';
import { getClusterByUserId } from '../controllers/clusterController.js';

const router = express.Router();

router.route('/:userId').get(getClusterByUserId);

export default router;