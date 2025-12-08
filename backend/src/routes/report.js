import express from 'express';
import { generateReport } from '../controllers/report.controller.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// Report generation route (protected)
router.post('/generate', authenticate, generateReport);

export default router;

