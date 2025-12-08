import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './src/routes/auth.js';
import userRoutes from './src/routes/user.js';
import predictRoutes from './src/routes/predict.js';
import pestRoutes from './src/routes/pest.js';
import fieldRoutes from "./src/routes/field.js";
import aiRoutes from './src/routes/ai.js';
import { analyzeNDVI } from './src/controllers/ndvi.controller.js';
// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/disease', predictRoutes);
app.use('/api/pest', pestRoutes);
app.use("/field", fieldRoutes);
app.use('/api/ai', aiRoutes);
app.post('/api/analyze-ndvi', analyzeNDVI);
// Health check
app.get('/', (req, res) => {
  res.json({ message: 'AgriVision API is running' });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

