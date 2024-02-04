import express from 'express';
import routes from './routes/routes.js';
import 'dotenv/config';


const app = express();
const port = process.env.PORT || 4000;
const host = process.env.HOST || 'localhost'; 


app.use(express.json());

app.use('', routes);


app.listen(port,host, () => {
  console.log(`Server is running at http://${host}:${port}`);
});
