import jwt from 'jsonwebtoken';
import 'dotenv/config';

function generateToken(payload) {
  return jwt.sign(payload, "123123", { expiresIn: '1h' });
}

function verifyToken(req, res, next) {
    const token = req.header('Authorization');
    if (!token) return res.status(401).json({ error: 'Access denied' });
    try {
     const decoded = jwt.verify(token, "123123123");
     next();
     } catch (error) {
    console.log(error);
     res.status(401).json({ error: 'Invalid token' });
     }
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