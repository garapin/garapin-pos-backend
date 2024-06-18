import express from 'express';
import routes from './routes/routes.js';
import 'dotenv/config';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import bodyParser from 'body-parser';
import setupCronJobs from './scheduler/scheduler.js';



const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const port = process.env.PORT || 4000;
const host = process.env.HOST || 'localhost'; 

// Setup cron jobs
setupCronJobs();

// Atur batas ukuran entitas menjadi 10MB
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ limit: '10mb', extended: true }));

app.use(express.json());

// Serve static files from the 'uploads' directory
app.use('/uploads', express.static('uploads'));
app.use('/images', express.static('images'));
app.use('/assets', express.static('assets'));
app.use('', routes);

app.listen(port, host, () => {
  console.log(`Server is running at http://${host}:${port}`);
});
