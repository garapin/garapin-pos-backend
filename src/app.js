import express from 'express';
import routes from './routes/routes.js';
import 'dotenv/config';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';


const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);


const app = express();
const port = process.env.PORT || 4000;
const host = process.env.HOST || 'localhost'; 


app.use(express.json());

// Serve static files from the 'uploads' directory
app.use('/uploads', express.static('uploads'));

app.use('', routes);


app.listen(port,host, () => {
  console.log(`Server is running at http://${host}:${port}`);
});
