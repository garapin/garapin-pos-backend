import "dotenv/config";
import admin from '../config/firebase.js';
import jwt from 'jsonwebtoken';
import { apiResponse } from '../utils/apiResponseFormat.js';

const JWT_SECRET = process.env.JWT_SECRET;
const DEBUG_MODE = process.env.DEBUG_MODE;

function generateToken(payload) {
  // test
  const expiresInDays = 30;
  const expiresInSeconds = expiresInDays * 24 * 60 * 60;
  return jwt.sign(payload, `${JWT_SECRET}`, { expiresIn: expiresInSeconds });
}

async function verifyToken(req, res, next) {
  if (DEBUG_MODE == "true") {
    next();
  } else if (DEBUG_MODE == "false") {
    const token = req.header('Authorization');
    if (!token) return apiResponse(res, 401, 'Invalid token!');
    try {
      await admin.auth().verifyIdToken(token);
      next();
    } catch (error) {
      return apiResponse(res, 401, 'Invalid token!');
    }
  }
}

export { verifyToken, generateToken };
