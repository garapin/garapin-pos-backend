// routes/storeRoutes.js
import express from 'express';
import storeController from '../controllers/storeController.js';

const router = express.Router();

// Rute pertama
router.post('/register', storeController.registerStore);

// Rute kedua
router.get('/get-info', storeController.getStoreInfo);

export default router;