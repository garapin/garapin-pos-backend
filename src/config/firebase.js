import "dotenv/config";
import admin from "firebase-admin";
import { readFileSync } from 'fs';

const serviceAccountPath = process.env.SERVICE_ACCOUNT_PATH;
if (!serviceAccountPath) {
    console.log("Error Service Account Path Firebase Not Found!");
}

const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

export default admin;
