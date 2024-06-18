const memoryStorage = {}; // In-memory storage to keep track of the current number for each month

// Function to generate the product ID
const generateRandomSku = async (awal = "RAK", rakModelStore) => {
  const now = new Date();
  const year = now.getFullYear().toString().slice(-2);
  const month = (now.getMonth() + 1).toString().padStart(2, "0"); // months are zero-based, so add 1
  const prefix = `${awal}${year}${month}`;

  // Find the most recent rak with the same prefix
  const lastRak = await rakModelStore
    .findOne({
      sku: new RegExp(`^${prefix}`),
    })
    .sort({ sku: -1 })
    .exec();

  let newIdNumber;

  if (lastRak) {
    const lastSku = lastRak.sku;
    const lastSkuMonth = lastSku.slice(5, 7); // Extract the month part from the SKU
    const lastSkuYear = lastSku.slice(3, 5); // Extract the year part from the SKU

    // Check if the year and month are the same as the current year and month
    if (lastSkuYear === year && lastSkuMonth === month) {
      const lastIdNumber = parseInt(lastSku.slice(-5), 10);
      newIdNumber = (lastIdNumber + 1).toString().padStart(5, "0");
    } else {
      newIdNumber = "00001";
    }
  } else {
    newIdNumber = "00001";
  }

  return `${prefix}${newIdNumber}`;
};

export { generateRandomSku };
