import express from 'express';
import { getSegments } from '../controllers/customerController.js';

const router = express.Router();

router.get('/segments', getSegments);

export default router;