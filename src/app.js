import express from 'express';
import routes from './routes/routes.js';

const app = express();
const port = process.env.PORT || 4000;
const ipAddress = process.env.IP_ADDRESS || 'localhost'; 


app.use(express.json());

app.use('', routes);


app.listen(port,ipAddress, () => {
  console.log(`Server is running at http://${ipAddress}:${port}`);
});
