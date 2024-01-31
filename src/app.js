// app.js
import express from 'express';
import routes from './routes/routes.js';

const app = express();
const port = 4000;


app.use(express.json());

app.use('', routes);


app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});
