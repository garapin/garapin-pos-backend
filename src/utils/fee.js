import { ConfigTransactionModel } from "../models/configTransaction.js";

const calculateFee = async (totalAmount, type) => {
  // Ambil data fee berdasarkan type dari MongoDB
  const feeData = await ConfigTransactionModel.findOne({ type: type });

  if (!feeData) return `Type ${type} not found in database`;

  // Hitung fee
  let fee = 0;

  // Jika ada flat fee
  if (feeData.fee_flat) {
    fee += feeData.fee_flat;
  }

  // Jika ada fee percent, tambahkan ke fee
  if (feeData.fee_percent) {
    fee += (feeData.fee_percent / 100) * totalAmount;
  }

  // Hitung VAT
  const vat = (feeData.vat_percent / 100) * fee;

  // Total fee termasuk VAT
  return (fee + vat).toFixed(2);
};

export default calculateFee;
