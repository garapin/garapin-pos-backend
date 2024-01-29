// app.js
import express from 'express';
import storeRoutes from './routes/storeRoutes.js';

const app = express();
const port = 4000;


app.use(express.json());

app.use('/store', storeRoutes);

app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});
