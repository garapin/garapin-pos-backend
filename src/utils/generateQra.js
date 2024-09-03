import QRCode from "qrcode";
import fs from "fs";
import path from "path";
import crypto from "crypto";

async function generateQr(url) {
  console.log("test");

  try {
    // Menentukan nama file berdasarkan hash dari URL dan path
    const fileName = generateFileNameFromUrl(url, "png");
    const filePath = path.join("images/qrfiles", fileName);

    // Memeriksa apakah file sudah ada
    if (fs.existsSync(filePath)) {
      // Jika file sudah ada, kembalikan URL file QR code
      console.log("File already exists:", filePath);

      return `/images/qrfiles/${fileName}`;
    }

    // Jika file tidak ada, hasilkan QR code dalam format PNG dan menyimpannya
    await QRCode.toFile(filePath, url);

    // Mengembalikan URL file QR code setelah disimpan
    return `/images/qrfiles/${fileName}`;
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
