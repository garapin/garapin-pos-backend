import jwt from "jsonwebtoken";
import "dotenv/config";

const JWT_SECRET = process.env.JWT_SECRET;
const DEBUG_MODE = process.env.DEBUG_MODE;

function generateToken(payload) {
  // test
  const expiresInDays = 30;
  const expiresInSeconds = expiresInDays * 24 * 60 * 60;
  return jwt.sign(payload, `${JWT_SECRET}`, { expiresIn: expiresInSeconds });
}

function verifyToken(req, res, next) {
  if (DEBUG_MODE == "true") {
    next();
  } else if (DEBUG_MODE == "false") {
    const token = req.header("Authorization");	
	console.log ({token});
    if (!token) return res.status(401).json({ error: "Access denied" });
    try {
      const decoded = jwt.verify(token, `${JWT_SECRET}`);
      console.log({ decoded });
      next();
    } catch (error) {
      console.log(error);
      return res.status(401).json({ error: "Invalid token" });
    }
  }
}

export { generateToken, verifyToken };