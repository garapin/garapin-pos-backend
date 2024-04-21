import jwt from 'jsonwebtoken';
import 'dotenv/config';


const JWT_SECRET = process.env.JWT_SECRET;

function generateToken(payload) {
  const expiresInDays = 30; 
  const expiresInSeconds = expiresInDays * 24 * 60 * 60;
  return jwt.sign(payload, `${JWT_SECRET}`, { expiresIn: expiresInSeconds });
}

function verifyToken(req, res, next) {
    const token = req.header('Authorization');
    if (!token) return res.status(401).json({ error: 'Access denied' });
    try {
     const decoded = jwt.verify(token, `${JWT_SECRET}`);
     next();
     } catch (error) {
    console.log(error);
     res.status(401).json({ error: 'Invalid token' });
     }
    next();
 };

export { generateToken, verifyToken };

// // Contoh penggunaan pembuatan token
// import { generateToken } from './helpers/jwt.js';

// const payload = { userId: 123 };
// const token = generateToken(payload);
// console.log('Token:', token);

// // Contoh penggunaan verifikasi token
// import { verifyToken } from './helpers/jwt.js';

// const tokenToVerify = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEyMywiaWF0IjoxNjM0Mjk1OTUxLCJleHAiOjE2MzQyOTkyNTF9.6l1gxO6RyBKJjF7z7tn7LHvZg6rU9IzZGc3tstVz7XA';
// verifyToken(tokenToVerify)
//   .then(decoded => {
//     console.log('Decoded:', decoded);
//   })
//   .catch(err => {
//     console.error('Error:', err);
//   });