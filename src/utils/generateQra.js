import QRCode from "qrcode";
import fs from "fs";
import path from "path";
import crypto from "crypto";

async function generateQr(url) {
  console.log("url", url);

  try {
    // Generate the QR code as a data URL (base64-encoded string)
    const qrDataUrl = await QRCode.toDataURL(url);

    // Return the QR code data URL
    return qrDataUrl;
  } catch (error) {
    console.error("Error generating QR code:", error);
    throw error;
  }
}
function generateFileNameFromUrl(url, extension = "png") {
  const hash = crypto.createHash("md5").update(url).digest("hex");
  return `${hash}.${extension}`;
}

export default generateQr;
