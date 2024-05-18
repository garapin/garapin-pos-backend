import express from "express";
import morgan from "morgan";
import bodyParser from "body-parser";
import routes from "./routes/routes.js";
import "dotenv/config";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

import { notFound } from "./utils/notFound.js";
import { errorHandler } from "./utils/errorHandling.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const port = process.env.PORT || 4000;
const host = process.env.HOST || "localhost";

// log activity

app.use(morgan("tiny"));

// Atur batas ukuran entitas menjadi 10MB
app.use(bodyParser.json({ limit: "10mb" }));
app.use(bodyParser.urlencoded({ limit: "10mb", extended: true }));

app.use(express.json());

// Serve static files from the 'uploads' directory
app.use("/uploads", express.static("uploads"));
app.use("/images", express.static("images"));
app.use("/assets", express.static("assets"));
app.use("", routes);

app.use(notFound);
app.use(errorHandler);

app.listen(port, host, () => {
  console.log(`Server is running at http://${host}:${port}`);
});
