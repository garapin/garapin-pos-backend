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

// Use 'express.static' middleware to serve static files
app.use('/uploads', express.static(join(dirname(__filename), 'uploads')));
console.log(join(dirname(__filename), 'uploads', 'store_images', 'image_1707185211245.png'));

app.use('', routes);


app.listen(port,host, () => {
  console.log(`Server is running at http://${host}:${port}`);
});
