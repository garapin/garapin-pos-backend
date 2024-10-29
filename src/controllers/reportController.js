import { connectTargetDatabase } from "../config/targetDatabase.js";
import { brandSchema } from "../models/brandmodel.js";
import mongoose from "mongoose";
const { ObjectId } = mongoose.Types;
import { categorySchema } from "../models/categoryModel.js";
import { transactionSchema } from "../models/transactionModel.js";
import { apiResponse } from "../utils/apiResponseFormat.js";
import Logger from "../utils/logger.js";
import { splitPaymentRuleIdScheme } from "../models/splitPaymentRuleIdModel.js";
import ExcelJS from "exceljs";

const reportTransaction = async (req, res) => {
  try {
    const {
      filter,
      targetDatabase,
      startDate,
      endDate,
      start = 0,
      length = 10,
      draw = 1,
    } = req.query;

    let totalGrossSales = 0;
    let totalDiscount = 0;
    let totalNetSales = 0;

    // Validasi dan konversi tanggal ke format ISO 8601
    if (!startDate || !endDate) {
      return apiResponse(res, 400, "startDate dan endDate diperlukan");
    }

    // Fungsi untuk mengkonversi waktu dari GMT+0 ke GMT+7
    const convertToGMT7 = (date) => {
      return new Date(date.getTime() + 7 * 60 * 60 * 1000);
    };

    // Konversi tanggal ke format ISO 8601
    const startISO = new Date(`${startDate}T00:00:00.000Z`);
    const endISO = new Date(`${endDate}T23:59:59.999Z`);

    if (isNaN(startISO.getTime()) || isNaN(endISO.getTime())) {
      return apiResponse(res, 400, "Format tanggal tidak valid");
    }

    const db = await connectTargetDatabase(targetDatabase);
    const TransactionData = db.model("Transaction", transactionSchema);

    // Fungsi untuk memeriksa apakah invoice mengandung QUICK_RELEASE
    const isQuickRelease = (invoice) => {
      return invoice && invoice.includes("QUICK_RELEASE");
    };

    const calculateTotalDiscount = (items) => {
      if (!Array.isArray(items)) {
        return 0; // Kembalikan 0 jika items bukan array
      }
      return items.reduce((total, item) => {
        const discount =
          item.product && item.product.discount ? item.product.discount : 0;
        const quantity = item.quantity || 1;
        return total + discount * quantity;
      }, 0);
    };

    if (filter === "Yearly") {
      const yearStart = new Date(`${startDate}T00:00:00.000Z`);
      const yearEnd = new Date(`${endDate}T23:59:59.999Z`);

      const monthlyData = Array(12)
        .fill()
        .map(() => ({
          grossSales: 0,
          discount: 0,
          netSales: 0,
        }));

      const allTransactions = await TransactionData.find({
        createdAt: { $gte: yearStart, $lte: yearEnd },
        status: "SUCCEEDED",
        invoice: { $regex: /^INV-/ },
      });

      const filteredTransactions = allTransactions.filter(
        (transaction) => !isQuickRelease(transaction.invoice)
      );

      filteredTransactions.forEach((transaction) => {
        const month = transaction.createdAt.getMonth();
        const discount =
          transaction.product && transaction.product.items
            ? calculateTotalDiscount(transaction.product.items)
            : 0;
        const grossSales =
          transaction.total_with_fee + discount - transaction.fee_garapin;
        const netSales = grossSales - discount;

        monthlyData[month].grossSales += grossSales;
        monthlyData[month].discount += discount;
        monthlyData[month].netSales += netSales;
        monthlyData[month].settlement_status = transaction.settlement_status;

        totalGrossSales += grossSales;
        totalDiscount += discount;
        totalNetSales += netSales;
      });

      const transactionList = monthlyData.map((data, index) => ({
        date: `${startDate.split("-")[0]}-${(index + 1).toString().padStart(2, "0")}-${startDate.split("-")[2]}`,
        invoice: "",
        settlement_status: data.settlement_status,
        grossSales: data.grossSales,
        discount: data.discount,
        netSales: data.netSales,
      }));

      // Buat workbook dan worksheet
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Laporan Transaksi");

      // Atur header
      worksheet.columns = [
        { header: "Transaction Date", key: "date", width: 15 },
        { header: "Gross Sales", key: "grossSales", width: 15 },
        { header: "Discount Sales", key: "discount", width: 15 },
        { header: "Nett Sales", key: "netSales", width: 15 },
      ];

      // Gaya untuk header
      const headerStyle = {
        font: { bold: true, color: { argb: "FFFFFF" } },
        fill: {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "4472C4" },
        },
        alignment: { horizontal: "center", vertical: "middle" },
      };

      // Terapkan gaya ke header
      worksheet.getRow(1).eachCell((cell) => {
        cell.style = headerStyle;
      });

      // Format angka
      const numberFormat = "#,##0.00";

      // Format tanggal dengan jam dan detik
      const dateFormat = "yyyy-MM";

      // Tambahkan data
      transactionList.forEach((transaction, index) => {
        const row = worksheet.addRow(transaction);
        row.getCell("grossSales").numFmt = numberFormat;
        row.getCell("discount").numFmt = numberFormat;
        row.getCell("netSales").numFmt = numberFormat;

        // Format tanggal
        row.getCell("date").numFmt = dateFormat;

        // Beri warna latar belakang selang-seling
        if (index % 2 === 0) {
          row.eachCell((cell) => {
            cell.fill = {
              type: "pattern",
              pattern: "solid",
              fgColor: { argb: "F2F2F2" },
            };
          });
        }
      });

      // Tambahkan total
      const totalRow = worksheet.addRow({
        date: "Total",
        invoice: "",
        grossSales: { formula: `SUM(B2:B${worksheet.rowCount})` },
        discount: { formula: `SUM(C2:C${worksheet.rowCount})` },
        netSales: { formula: `SUM(D2:D${worksheet.rowCount})` },
      });

      // Gaya untuk baris total
      const totalStyle = {
        font: { bold: true },
        fill: {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "E2EFDA" },
        },
      };

      totalRow.eachCell((cell, colNumber) => {
        cell.style = totalStyle;
        if (colNumber >= 3 && colNumber <= 5) {
          // Kolom C, D, dan E
          cell.numFmt = numberFormat;
        }
      });

      // Tambahkan border ke seluruh tabel
      worksheet.eachRow((row) => {
        row.eachCell((cell) => {
          cell.border = {
            top: { style: "thin" },
            left: { style: "thin" },
            bottom: { style: "thin" },
            right: { style: "thin" },
          };
        });
      });

      // Buat buffer dari workbook
      const buffer = await workbook.xlsx.writeBuffer();

      return apiResponse(res, 200, "Transaction report fetched successfully", {
        transactions: transactionList,
        totalGrossSales,
        totalDiscount,
        totalNetSales,
        draw: parseInt(draw),
        recordsTotal: allTransactions.length,
        recordsFiltered: transactionList.length,
        excelBuffer: buffer.toString("base64"),
      });
    }

    // Hitung total records dan total sales
    const allTransactions = await TransactionData.find({
      createdAt: { $gte: startISO, $lte: endISO },
      status: "SUCCEEDED",
      invoice: { $regex: /^INV-/ },
    });
    console.log(allTransactions);

    const filteredTransactions = allTransactions.filter(
      (transaction) => !isQuickRelease(transaction.invoice)
    );

    filteredTransactions.forEach((transaction) => {
      const discount =
        transaction.product && transaction.product.items
          ? calculateTotalDiscount(transaction.product.items)
          : 0;
      const grossSales =
        transaction.total_with_fee + discount - transaction.fee_garapin;
      const netSales = grossSales - discount;

      totalGrossSales += grossSales;
      totalDiscount += discount;
      totalNetSales += netSales;
    });

    // Ambil data dengan pagination
    const transactions = await TransactionData.find({
      createdAt: { $gte: startISO, $lte: endISO },
      status: "SUCCEEDED",
      invoice: { $regex: /^INV-/ },
    })
      .skip(parseInt(start))
      .limit(parseInt(length));

    const filteredTrx = allTransactions.filter(
      (transaction) => !isQuickRelease(transaction.invoice)
    );

    const transactionList = filteredTrx.map((transaction) => {
      const discount =
        transaction.product && transaction.product.items
          ? calculateTotalDiscount(transaction.product.items)
          : 0;
      const grossSales =
        transaction.total_with_fee + discount - transaction.fee_garapin;
      const netSales = grossSales - discount;

      return {
        date: transaction.createdAt,
        invoice: transaction.invoice_label,
        settlement_status: transaction.settlement_status,
        grossSales,
        discount,
        netSales,
      };
    });

    // Buat workbook dan worksheet
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Laporan Transaksi");

    // Atur header
    worksheet.columns = [
      { header: "Transaction Date", key: "date", width: 15 },
      { header: "Invoice No", key: "invoice", width: 20 },
      { header: "Status", key: "settlement_status", width: 20 },
      { header: "Gross Sales", key: "grossSales", width: 15 },
      { header: "Discount Sales", key: "discount", width: 15 },
      { header: "Nett Sales", key: "netSales", width: 15 },
    ];

    // Gaya untuk header
    const headerStyle = {
      font: { bold: true, color: { argb: "FFFFFF" } },
      fill: { type: "pattern", pattern: "solid", fgColor: { argb: "4472C4" } },
      alignment: { horizontal: "center", vertical: "middle" },
    };

    // Terapkan gaya ke header
    worksheet.getRow(1).eachCell((cell) => {
      cell.style = headerStyle;
    });

    // Format angka
    const numberFormat = "#,##0.00";
    const dateFormat = "yyyy-mm-dd hh:mm:ss";

    // Tambahkan data
    transactionList.forEach((transaction, index) => {
      const row = worksheet.addRow(transaction);
      row.getCell("grossSales").numFmt = numberFormat;
      row.getCell("discount").numFmt = numberFormat;
      row.getCell("netSales").numFmt = numberFormat;

      // Format tanggal
      row.getCell("date").numFmt = dateFormat;

      // Beri warna latar belakang selang-seling
      if (index % 2 === 0) {
        row.eachCell((cell) => {
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "F2F2F2" },
          };
        });
      }
    });

    // Tambahkan total
    const totalRow = worksheet.addRow({
      date: "Total",
      invoice: "",
      settlement_status: "",
      grossSales: { formula: `SUM(D2:D${worksheet.rowCount})` },
      discount: { formula: `SUM(E2:E${worksheet.rowCount})` },
      netSales: { formula: `SUM(F2:F${worksheet.rowCount})` },
    });

    // Gaya untuk baris total
    const totalStyle = {
      font: { bold: true },
      fill: { type: "pattern", pattern: "solid", fgColor: { argb: "E2EFDA" } },
    };

    totalRow.eachCell((cell, colNumber) => {
      cell.style = totalStyle;
      if (colNumber >= 3 && colNumber <= 5) {
        // Kolom C, D, dan E
        cell.numFmt = numberFormat;
      }
    });

    // Tambahkan border ke seluruh tabel
    worksheet.eachRow((row) => {
      row.eachCell((cell) => {
        cell.border = {
          top: { style: "thin" },
          left: { style: "thin" },
          bottom: { style: "thin" },
          right: { style: "thin" },
        };
      });
    });

    // Buat buffer dari workbook
    const buffer = await workbook.xlsx.writeBuffer();

    return apiResponse(res, 200, "Transaction report fetched successfully", {
      transactions: transactionList,
      totalGrossSales,
      totalDiscount,
      totalNetSales,
      draw: parseInt(draw),
      recordsTotal: allTransactions.length,
      recordsFiltered: transactions.length,
      excelBuffer: buffer.toString("base64"),
    });
  } catch (error) {
    console.log(error);
    return apiResponse(res, 500, "Internal server error", error.message);
  }
};

const reportTransactionByPaymentMethod = async (req, res) => {
  try {
    const {
      filter,
      targetDatabase,
      startDate,
      endDate,
      start = 0,
      length = 10,
      draw = 1,
    } = req.query;

    // Validasi dan konversi tanggal ke format ISO 8601
    if (!startDate || !endDate) {
      return apiResponse(res, 400, "startDate dan endDate diperlukan");
    }

    // Konversi tanggal ke format ISO 8601
    const startISO = new Date(`${startDate}T00:00:00.000Z`);
    const endISO = new Date(`${endDate}T23:59:59.999Z`);

    if (isNaN(startISO.getTime()) || isNaN(endISO.getTime())) {
      return apiResponse(res, 400, "Format tanggal tidak valid");
    }

    // Fungsi untuk memeriksa apakah invoice mengandung QUICK_RELEASE
    const isQuickRelease = (invoice) => {
      return invoice && invoice.includes("QUICK_RELEASE");
    };

    const db = await connectTargetDatabase(targetDatabase);
    const TransactionData = db.model("Transaction", transactionSchema);

    const calculateTotalDiscount = (items) => {
      if (!Array.isArray(items)) {
        return 0; // Kembalikan 0 jika items bukan array
      }
      return items.reduce((total, item) => {
        const discount =
          item.product && item.product.discount ? item.product.discount : 0;
        const quantity = item.quantity || 1;
        return total + discount * quantity;
      }, 0);
    };

    if (filter === "Yearly") {
      const yearStart = new Date(
        `${startDate.split("-")[0]}-01-01T00:00:00.000Z`
      );
      const yearEnd = new Date(`${endDate.split("-")[0]}-12-31T23:59:59.999Z`);

      const monthlyData = Array(12)
        .fill()
        .map(() => ({
          cash: { grossSales: 0, discount: 0, netSales: 0 },
          qris: { grossSales: 0, discount: 0, netSales: 0 },
          va: { grossSales: 0, discount: 0, netSales: 0 },
        }));

      const allTransactions = await TransactionData.find({
        createdAt: { $gte: yearStart, $lte: yearEnd },
        status: "SUCCEEDED",
        invoice: { $regex: /^INV-/ },
      });

      const filteredTransactions = allTransactions.filter(
        (transaction) => !isQuickRelease(transaction.invoice)
      );

      filteredTransactions.forEach((transaction) => {
        const month = transaction.createdAt.getMonth();
        const grossSales = transaction.total_with_fee - transaction.fee_garapin;
        const discount =
          transaction.product && transaction.product.items
            ? calculateTotalDiscount(transaction.product.items)
            : 0;
        const netSales = grossSales - discount;
        const paymentMethod = transaction.payment_method.toLowerCase();

        if (paymentMethod === "cash") {
          monthlyData[month].cash.grossSales += grossSales;
          monthlyData[month].cash.discount += discount;
          monthlyData[month].cash.netSales += netSales;
        } else if (paymentMethod === "qris" || paymentMethod === "qr_qode") {
          monthlyData[month].qris.grossSales += grossSales;
          monthlyData[month].qris.discount += discount;
          monthlyData[month].qris.netSales += netSales;
        } else if (paymentMethod === "virtual_account") {
          monthlyData[month].va.grossSales += grossSales;
          monthlyData[month].va.discount += discount;
          monthlyData[month].va.netSales += netSales;
        }
      });

      const transactionList = monthlyData.flatMap((data, index) => {
        const date = `${yearStart.getFullYear()}-${(index + 1).toString().padStart(2, "0")}-01`;
        return [
          {
            date,
            grossSales: data.cash.grossSales,
            discount: data.cash.discount,
            netSales: data.cash.netSales,
            paymentMethod: "CASH",
          },
          {
            date,
            grossSales: data.qris.grossSales,
            discount: data.qris.discount,
            netSales: data.qris.netSales,
            paymentMethod: "QRIS",
          },
          {
            date,
            grossSales: data.va.grossSales,
            discount: data.va.discount,
            netSales: data.va.netSales,
            paymentMethod: "VIRTUAL_ACCOUNT",
          },
        ];
      });

      const totalCash = transactionList.reduce(
        (sum, item) =>
          item.paymentMethod === "CASH" ? sum + item.netSales : sum,
        0
      );
      const totalQris = transactionList.reduce(
        (sum, item) =>
          item.paymentMethod === "QRIS" ? sum + item.netSales : sum,
        0
      );
      const totalVa = transactionList.reduce(
        (sum, item) =>
          item.paymentMethod === "VIRTUAL_ACCOUNT" ? sum + item.netSales : sum,
        0
      );
      const totalNetSales = totalCash + totalQris + totalVa;

      const totalGrossSales = transactionList.reduce(
        (sum, item) => sum + item.grossSales,
        0
      );
      const totalDiscount = transactionList.reduce(
        (sum, item) => sum + item.discount,
        0
      );

      // Buat workbook dan worksheet
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet(
        "Laporan Transaksi per Metode Pembayaran (Tahunan)"
      );

      // Atur header
      worksheet.columns = [
        { header: "Tanggal", key: "date", width: 15 },
        { header: "Penjualan Kotor", key: "grossSales", width: 20 },
        { header: "Diskon", key: "discount", width: 15 },
        { header: "Penjualan Bersih", key: "netSales", width: 20 },
        { header: "Metode Pembayaran", key: "paymentMethod", width: 20 },
      ];

      // Gaya untuk header
      const headerStyle = {
        font: { bold: true, color: { argb: "FFFFFF" } },
        fill: {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "4472C4" },
        },
        alignment: { horizontal: "center", vertical: "middle" },
      };

      // Terapkan gaya ke header
      worksheet.getRow(1).eachCell((cell) => {
        cell.style = headerStyle;
      });

      // Format angka
      const numberFormat = "#,##0.00";

      // Tambahkan data
      transactionList.forEach((transaction, index) => {
        const row = worksheet.addRow(transaction);
        row.getCell("grossSales").numFmt = numberFormat;
        row.getCell("discount").numFmt = numberFormat;
        row.getCell("netSales").numFmt = numberFormat;

        // Beri warna latar belakang selang-seling
        if (index % 2 === 0) {
          row.eachCell((cell) => {
            cell.fill = {
              type: "pattern",
              pattern: "solid",
              fgColor: { argb: "F2F2F2" },
            };
          });
        }
      });

      // Tambahkan total
      const totalRow = worksheet.addRow({
        date: "Total",
        grossSales: totalGrossSales,
        discount: totalDiscount,
        netSales: totalNetSales,
        paymentMethod: "",
      });

      // Gaya untuk baris total
      const totalStyle = {
        font: { bold: true },
        fill: {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "E2EFDA" },
        },
      };

      totalRow.eachCell((cell, colNumber) => {
        cell.style = totalStyle;
        if (colNumber >= 3 && colNumber <= 5) {
          // Kolom C, D, dan E
          cell.numFmt = numberFormat;
        }
      });

      // Tambahkan border ke seluruh tabel
      worksheet.eachRow((row) => {
        row.eachCell((cell) => {
          cell.border = {
            top: { style: "thin" },
            left: { style: "thin" },
            bottom: { style: "thin" },
            right: { style: "thin" },
          };
        });
      });

      // Buat buffer dari workbook
      const buffer = await workbook.xlsx.writeBuffer();

      return apiResponse(res, 200, "Transaction report fetched successfully", {
        transactions: transactionList,
        totalCash,
        totalQris,
        totalVa,
        totalNetSales,
        totalGrossSales,
        totalDiscount,
        draw: parseInt(draw),
        recordsTotal: allTransactions.length,
        recordsFiltered: transactionList.length,
        excelBuffer: buffer.toString("base64"),
      });
    }

    // Hitung total records dan total sales per metode pembayaran
    const allTransactions = await TransactionData.find({
      createdAt: { $gte: startISO, $lte: endISO },
      status: "SUCCEEDED",
      invoice: { $regex: /^INV-/ },
    });

    let totalCash = 0;
    let totalQris = 0;
    let totalVa = 0;
    let totalNetSales = 0;

    const transactionList = { cash: {}, qris: {}, va: {} };

    const filteredTransactions = allTransactions.filter(
      (transaction) => !isQuickRelease(transaction.invoice)
    );

    filteredTransactions.forEach((transaction) => {
      const discount =
        transaction.product && transaction.product.items
          ? calculateTotalDiscount(transaction.product.items)
          : 0;
      const grossSales =
        transaction.total_with_fee + discount - transaction.fee_garapin;
      const netSales = grossSales - discount;
      const paymentMethod = transaction.payment_method.toLowerCase();
      const date = transaction.createdAt.toISOString().split("T")[0];

      if (paymentMethod === "cash") {
        totalCash += netSales;
      } else if (paymentMethod === "qris" || paymentMethod === "qr_qode") {
        totalQris += netSales;
      } else if (paymentMethod === "virtual_account") {
        totalVa += netSales;
      }

      if (paymentMethod && transactionList[paymentMethod]) {
        if (!transactionList[paymentMethod][date]) {
          transactionList[paymentMethod][date] = {
            date,
            grossSales: 0,
            discount: 0,
            netSales: 0,
          };
        }
        transactionList[paymentMethod][date].grossSales += grossSales;
        transactionList[paymentMethod][date].discount += discount;
        transactionList[paymentMethod][date].netSales += netSales;
      }
    });

    totalNetSales = totalCash + totalQris + totalVa;

    // Ambil data dengan pagination
    const transactions = await TransactionData.find({
      createdAt: { $gte: startISO, $lte: endISO },
      status: "SUCCEEDED",
      invoice: { $regex: /^INV-/ },
    })
      .skip(parseInt(start))
      .limit(parseInt(length));

    const paginatedTransactionList = {};

    const transactionFiltered = transactions.filter(
      (transaction) => !isQuickRelease(transaction.invoice)
    );

    transactionFiltered.forEach((transaction) => {
      const discount =
        transaction.product && transaction.product.items
          ? calculateTotalDiscount(transaction.product.items)
          : 0;
      const grossSales =
        transaction.total_with_fee + discount - transaction.fee_garapin;
      const netSales = grossSales - discount;
      const paymentMethod = transaction.payment_method.toLowerCase();
      const date = transaction.createdAt.toISOString().split("T")[0];

      if (!paginatedTransactionList[paymentMethod]) {
        paginatedTransactionList[paymentMethod] = {};
      }

      if (!paginatedTransactionList[paymentMethod][date]) {
        paginatedTransactionList[paymentMethod][date] = {
          date,
          grossSales: 0,
          discount: 0,
          netSales: 0,
          paymentMethod: paymentMethod.toUpperCase(),
        };
      }

      paginatedTransactionList[paymentMethod][date].grossSales += grossSales;
      paginatedTransactionList[paymentMethod][date].discount += discount;
      paginatedTransactionList[paymentMethod][date].netSales += netSales;
    });

    const formattedPaginatedTransactionList = Object.keys(
      paginatedTransactionList
    ).flatMap((method) => Object.values(paginatedTransactionList[method]));

    // Urutkan formattedPaginatedTransactionList berdasarkan tanggal
    formattedPaginatedTransactionList.sort((a, b) => {
      return new Date(a.date) - new Date(b.date);
    });

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet(
      "Laporan Transaksi per Metode Pembayaran"
    );

    // Atur lebar kolom
    worksheet.columns = [
      { header: "Tanggal", key: "date", width: 15 },
      { header: "Metode Pembayaran", key: "paymentMethod", width: 20 },
      { header: "Penjualan Kotor", key: "grossSales", width: 15 },
      { header: "Diskon", key: "discount", width: 15 },
      { header: "Penjualan Bersih", key: "netSales", width: 15 },
    ];

    // Gaya untuk header
    const headerStyle = {
      font: { bold: true, color: { argb: "FFFFFF" } },
      fill: { type: "pattern", pattern: "solid", fgColor: { argb: "4472C4" } },
      alignment: { horizontal: "center", vertical: "middle" },
    };

    // Terapkan gaya ke header
    worksheet.getRow(1).eachCell((cell) => {
      cell.style = headerStyle;
    });

    // Format angka untuk kolom penjualan dan diskon
    const numberFormat = "#,##0.00";

    // Tambahkan data
    formattedPaginatedTransactionList.forEach((transaction, index) => {
      const row = worksheet.addRow(transaction);
      row.getCell("grossSales").numFmt = numberFormat;
      row.getCell("discount").numFmt = numberFormat;
      row.getCell("netSales").numFmt = numberFormat;

      // Beri warna latar belakang selang-seling
      if (index % 2 === 0) {
        row.eachCell((cell) => {
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "F2F2F2" },
          };
        });
      }
    });

    // Tambahkan total
    const totalRow = worksheet.addRow({
      date: "Total",
      paymentMethod: "",
      grossSales: { formula: `SUM(C2:C${worksheet.rowCount})` },
      discount: { formula: `SUM(D2:D${worksheet.rowCount})` },
      netSales: { formula: `SUM(E2:E${worksheet.rowCount})` },
    });

    // Gaya untuk baris total
    const totalStyle = {
      font: { bold: true },
      fill: { type: "pattern", pattern: "solid", fgColor: { argb: "E2EFDA" } },
    };

    totalRow.eachCell((cell, colNumber) => {
      cell.style = totalStyle;
      if (colNumber >= 3 && colNumber <= 5) {
        // Kolom C, D, dan E
        cell.numFmt = numberFormat;
      }
    });

    console.log("Total row values:");
    totalRow.eachCell((cell, colNumber) => {
      console.log(`Column ${colNumber}: ${cell.value}`);
    });

    // Tambahkan border ke seluruh tabel
    worksheet.eachRow((row) => {
      row.eachCell((cell) => {
        cell.border = {
          top: { style: "thin" },
          left: { style: "thin" },
          bottom: { style: "thin" },
          right: { style: "thin" },
        };
      });
    });

    // Buat buffer dari workbook
    const buffer = await workbook.xlsx.writeBuffer();

    return apiResponse(res, 200, "Transaction report fetched successfully", {
      transactions: formattedPaginatedTransactionList,
      totalCash,
      totalQris,
      totalVa,
      totalNetSales,
      draw: parseInt(draw),
      recordsTotal: allTransactions.length,
      recordsFiltered: transactions.length,
      excelBuffer: buffer.toString("base64"),
    });
  } catch (error) {
    console.log(error);
    return apiResponse(res, 500, "Internal server error", error.message);
  }
};

const reportTransactionByProduct = async (req, res) => {
  try {
    const {
      targetDatabase,
      startDate,
      endDate,
      start = 0,
      length = 10,
      draw = 1,
    } = req.query;

    const { category, brand } = req.headers;

    let totalGrossSales = 0;
    let totalDiscount = 0;
    let totalNetSales = 0;
    let uniqueInvoices = new Set();

    // Validasi dan konversi tanggal ke format ISO 8601
    if (!startDate || !endDate) {
      return apiResponse(res, 400, "startDate dan endDate diperlukan");
    }

    // Konversi tanggal ke format ISO 8601
    const startISO = new Date(`${startDate}T00:00:00.000Z`);
    const endISO = new Date(`${endDate}T23:59:59.999Z`);

    if (isNaN(startISO.getTime()) || isNaN(endISO.getTime())) {
      return apiResponse(res, 400, "Format tanggal tidak valid");
    }

    const db = await connectTargetDatabase(targetDatabase);
    const TransactionData = db.model("Transaction", transactionSchema);

    // Hitung total records dan total sales per produk
    const allTransactions = await TransactionData.find({
      createdAt: { $gte: startISO, $lte: endISO },
      status: "SUCCEEDED",
      invoice: { $regex: /^INV-/ },
    });

    var productList = [];

    // Filter transaksi berdasarkan kategori atau brand jika ada
    let filteredTransactions = allTransactions;
    if (category) {
      const categoryIds = category.split(",").map((id) => new ObjectId(id));
      filteredTransactions = filteredTransactions.filter((transaction) => {
        if (transaction.product && transaction.product.items) {
          for (const item of transaction.product.items) {
            if (
              categoryIds.some((categoryId) =>
                item.product.category_ref.equals(categoryId)
              )
            ) {
              return true;
            }
          }
        }
        return false;
      });
    }
    if (brand) {
      const brandIds = brand.split(",").map((id) => new ObjectId(id));
      filteredTransactions = filteredTransactions.filter((transaction) => {
        if (transaction.product && transaction.product.items) {
          for (const item of transaction.product.items) {
            if (
              brandIds.some((brandId) => item.product.brand_ref.equals(brandId))
            ) {
              return true;
            }
          }
        }
        return false;
      });
    }

    console.log("LENGTH FILTER", filteredTransactions.length);
    await Promise.all(
      filteredTransactions.map(async (transaction) => {
        if (transaction.product && transaction.product.items) {
          await Promise.all(
            transaction.product.items.map(async (item) => {
              const productId = item.product._id;
              const productName = item.product.name;
              const skuName = item.product.sku;
              const productCategoryRef = item.product.category_ref; // Asumsikan ada field category
              const productBrandRef = item.product.brand_ref;
              const quantity = item.quantity;
              const grossSales = item.product.price;
              const discount = (item.product.discount || 0) * quantity;
              const totalPrice = grossSales * quantity;

              // Ambil nama kategori dari tabel categories
              const CategoryModelStore = db.model("Category", categorySchema);
              const categoryData =
                await CategoryModelStore.findById(productCategoryRef);
              const productCategory = categoryData
                ? categoryData.category
                : "Unknown";

              // Ambil nama brand dari tabel brands
              const BrandModelStore = db.model("Brand", brandSchema);
              const brandData = await BrandModelStore.findById(productBrandRef);
              const productBrand = brandData ? brandData.brand : "Unknown";

              productList.push({
                date: transaction.createdAt,
                invoice: transaction.invoice_label,
                sku: skuName,
                productId,
                productName,
                category: {
                  id: productCategoryRef,
                  name: productCategory,
                },
                brand: {
                  id: productBrandRef,
                  name: productBrand,
                },
                quantity,
                grossSales,
                discount,
                totalPrice,
                totalPriceTransaction: totalPrice - discount,
              });

              uniqueInvoices.add(transaction.invoice_label);
            })
          );
        }

        // totalGrossSales += transaction.total_with_fee;
        // totalDiscount += transaction.discount || 0;
        // totalNetSales += transaction.total_with_fee - totalDiscount;
      })
    );

    if (category) {
      const categoryId = new ObjectId(category);
      productList = productList.filter((product) =>
        product.category.id.equals(categoryId)
      );
    }

    if (brand) {
      const brandId = new ObjectId(brand);
      productList = productList.filter((product) =>
        product.brand.id.equals(brandId)
      );
    }

    console.log("LENGTH PRODUCT LIST", productList.length);

    // Kalkulasi ulang total berdasarkan productList
    productList.forEach((product) => {
      totalGrossSales += product.grossSales * product.quantity;
      totalDiscount += product.discount;
      totalNetSales += product.totalPrice - product.discount;
    });

    // Ambil data dengan pagination
    const paginatedProductList = productList.slice(
      parseInt(start),
      parseInt(start) + parseInt(length)
    );

    const totalTransactions = uniqueInvoices.size;

    // Buat workbook dan worksheet
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Laporan Transaksi per Produk");

    // Atur header
    worksheet.columns = [
      { header: "Tanggal", key: "date", width: 15 },
      { header: "Invoice", key: "invoice", width: 20 },
      { header: "SKU", key: "sku", width: 15 },
      { header: "Nama Produk", key: "productName", width: 30 },
      { header: "Kategori", key: "category", width: 20 },
      { header: "Brand", key: "brand", width: 20 },
      { header: "Kuantitas", key: "quantity", width: 10 },
      { header: "Harga Produk", key: "productPrice", width: 20 },
      {
        header: "Penjualan Kotor (qty * harga produk)",
        key: "grossSales",
        width: 15,
      },
      { header: "Diskon", key: "discount", width: 15 },
      { header: "Total Harga", key: "totalPrice", width: 15 },
    ];

    // Gaya untuk header
    const headerStyle = {
      font: { bold: true, color: { argb: "FFFFFF" } },
      fill: { type: "pattern", pattern: "solid", fgColor: { argb: "4472C4" } },
      alignment: { horizontal: "center", vertical: "middle" },
    };

    // Terapkan gaya ke header
    worksheet.getRow(1).eachCell((cell) => {
      cell.style = headerStyle;
    });

    // Format angka
    const numberFormat = "#,##0.00";

    // Format tanggal dengan jam dan detik
    const dateFormat = "yyyy-mm-dd hh:mm:ss";

    // Tambahkan data
    paginatedProductList.forEach((product, index) => {
      const row = worksheet.addRow({
        date: product.date,
        invoice: product.invoice,
        sku: product.sku,
        productName: product.productName,
        category: product.category.name,
        brand: product.brand.name,
        quantity: product.quantity,
        productPrice: product.grossSales,
        grossSales: product.grossSales * product.quantity,
        discount: product.discount,
        totalPrice: product.totalPrice - product.discount,
      });

      // Format tanggal
      row.getCell("date").numFmt = dateFormat;

      // Format angka
      row.getCell("productPrice").numFmt = numberFormat;
      row.getCell("grossSales").numFmt = numberFormat;
      row.getCell("discount").numFmt = numberFormat;
      row.getCell("totalPrice").numFmt = numberFormat;

      console.log(`Row ${index}:`, row.values);

      // Beri warna latar belakang selang-seling
      if (index % 2 === 0) {
        row.eachCell((cell) => {
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "F2F2F2" },
          };
        });
      }
    });

    // Tambahkan total
    const totalRow = worksheet.addRow({
      date: "Total",
      invoice: "",
      sku: "",
      productId: "",
      productName: "",
      category: "",
      brand: "",
      quantity: { formula: `SUM(G2:G${worksheet.rowCount})` },
      productPrice: { formula: `SUM(H2:H${worksheet.rowCount})` },
      grossSales: { formula: `SUM(I2:I${worksheet.rowCount})` },
      discount: { formula: `SUM(J2:J${worksheet.rowCount})` },
      totalPrice: { formula: `SUM(K2:K${worksheet.rowCount})` },
    });

    // Gaya untuk baris total
    const totalStyle = {
      font: { bold: true },
      fill: { type: "pattern", pattern: "solid", fgColor: { argb: "E2EFDA" } },
    };

    totalRow.eachCell((cell, colNumber) => {
      cell.style = totalStyle;
      if (colNumber >= 3 && colNumber <= 11) {
        // Kolom C, D, dan E
        cell.numFmt = numberFormat;
      }
    });

    // Tambahkan border ke seluruh tabel
    worksheet.eachRow((row) => {
      row.eachCell((cell) => {
        cell.border = {
          top: { style: "thin" },
          left: { style: "thin" },
          bottom: { style: "thin" },
          right: { style: "thin" },
        };
      });
    });

    // Buat buffer dari workbook
    const buffer = await workbook.xlsx.writeBuffer();

    return apiResponse(res, 200, "Transaction report fetched successfully", {
      transactions: paginatedProductList.reverse(),
      draw: parseInt(draw),
      recordsTotal: productList.length,
      recordsFiltered: paginatedProductList.length,
      totalGrossSales,
      totalDiscount,
      totalNetSales,
      totalTransactions,
      excelBuffer: buffer.toString("base64"),
    });
  } catch (error) {
    console.log(error);
    return apiResponse(res, 500, "Internal server error", error.message);
  }
};

const reportBagiBagi = async (req, res) => {
  try {
    const {
      targetDatabase,
      startDate,
      endDate,
      start = 0,
      length = 10,
      draw = 1,
    } = req.query;

    let totalBagiBagiPendapatan = 0;
    let totalBagiBagiBiaya = 0;
    let totalNetSales = 0;
    let uniqueInvoices = new Set();
    const uniqueInvoiceNetSales = new Map();

    // Validasi dan konversi tanggal ke format ISO 8601
    if (!startDate || !endDate) {
      return apiResponse(res, 400, "startDate dan endDate diperlukan");
    }

    // Fungsi untuk memisahkan invoice dan mengambil bagian pertama
    const getInvoiceNumber = (invoice) => {
      return invoice.split("&&")[0];
    };

    // Konversi tanggal ke format ISO 8601
    const startISO = new Date(`${startDate}T00:00:00.000Z`);
    const endISO = new Date(`${endDate}T23:59:59.999Z`);

    if (isNaN(startISO.getTime()) || isNaN(endISO.getTime())) {
      return apiResponse(res, 400, "Format tanggal tidak valid");
    }

    const db = await connectTargetDatabase(targetDatabase);
    const TransactionData = db.model("Transaction", transactionSchema);
    const SplitPaymentRuleData = db.model(
      "Split_Payment_Rule_Id",
      splitPaymentRuleIdScheme
    );

    // Ambil transaksi yang sukses
    const successfulTransactions = await TransactionData.find({
      createdAt: { $gte: startISO, $lte: endISO },
      status: "SUCCEEDED",
      invoice: { $regex: /^INV-/ },
    }).select("invoice total_with_fee settlement_status");

    // Buat array invoice label dari transaksi sukses
    const successfulInvoices = successfulTransactions.map((t) => t.invoice);
    const transactionStatusMap = new Map(
      successfulTransactions.map((t) => [t.invoice, t.settlement_status])
    );

    const splitPaymentRules = await SplitPaymentRuleData.find({
      invoice: { $in: successfulInvoices },
      created_at: { $gte: startISO, $lte: endISO },
    });

    const transactionList = [];
    splitPaymentRules.forEach((rule) => {
      if (rule.routes) {
        const invoiceNumber = getInvoiceNumber(rule.invoice);
        uniqueInvoices.add(rule.invoice); // Tambahkan invoice ke Set

        // Simpan netSales untuk invoice unik
        if (!uniqueInvoiceNetSales.has(invoiceNumber)) {
          uniqueInvoiceNetSales.set(invoiceNumber, rule.amount || 0);
        }

        rule.routes.forEach((route) => {
          console.log(route);

          route.role !== "FEE"
            ? (totalBagiBagiPendapatan += route.flat_amount)
            : 0; // Kalkulasi totalBagiBagiPendapatan
          route.role == "FEE" ? (totalBagiBagiBiaya += route.flat_amount) : 0;

          transactionList.push({
            date: rule.created_at,
            invoice: invoiceNumber,
            status: transactionStatusMap.get(rule.invoice) || "",
            type: route.role,
            target:
              route.target === "garapin"
                ? "Biaya BagiBagiPOS"
                : route.target || 0,
            netSales: rule.amount || 0,
            costBagiBagiPOS: route.role === "FEE" ? route.flat_amount || 0 : 0,
            percentageBagiBagiBiaya: route.fee_pos || 0,
            percentageFeePos: route.percent_amount || 0,
            bagiBagiBiaya: route.fee || 0,
            bagiBagiPendapatan:
              route.role !== "FEE" ? route.flat_amount : 0 || 0,
          });
        });
      }
    });

    // Hitung totalNetSales dari invoice unik
    totalNetSales = Array.from(uniqueInvoiceNetSales.values()).reduce(
      (sum, netSales) => sum + netSales,
      0
    );

    const totalTransaction = uniqueInvoices.size;

    const paginatedTransactionList = transactionList.slice(
      parseInt(start),
      parseInt(start) + parseInt(length)
    );

    // Hitung total berdasarkan invoice
    const invoiceTotals = {};
    transactionList.forEach((transaction) => {
      if (!invoiceTotals[transaction.invoice]) {
        invoiceTotals[transaction.invoice] = {
          netSales: 0,
          costBagiBagiPOS: 0,
          bagiBagiBiaya: 0,
          bagiBagiPendapatan: 0,
        };
      }
      invoiceTotals[transaction.invoice].netSales += transaction.netSales;
      invoiceTotals[transaction.invoice].costBagiBagiPOS +=
        transaction.costBagiBagiPOS;
      invoiceTotals[transaction.invoice].bagiBagiBiaya +=
        transaction.bagiBagiBiaya;
      invoiceTotals[transaction.invoice].bagiBagiPendapatan +=
        transaction.bagiBagiPendapatan;
    });

    // Hitung grand total
    const grandTotal = Object.values(invoiceTotals).reduce(
      (acc, curr) => {
        acc.netSales += curr.netSales;
        acc.costBagiBagiPOS += curr.costBagiBagiPOS;
        acc.bagiBagiBiaya += curr.bagiBagiBiaya;
        acc.bagiBagiPendapatan += curr.bagiBagiPendapatan;
        return acc;
      },
      {
        netSales: 0,
        costBagiBagiPOS: 0,
        bagiBagiBiaya: 0,
        bagiBagiPendapatan: 0,
      }
    );

    // Kelompokkan data berdasarkan invoice
    const groupedTransactions = {};
    transactionList.forEach((transaction) => {
      if (!groupedTransactions[transaction.invoice]) {
        groupedTransactions[transaction.invoice] = [];
      }
      groupedTransactions[transaction.invoice].push(transaction);
    });

    // Buat workbook dan worksheet
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Laporan Bagi Bagi");

    // Atur header
    worksheet.columns = [
      { header: "Tanggal", key: "date", width: 15 },
      { header: "Invoice", key: "invoice", width: 20 },
      { header: "Status", key: "status", width: 15 },
      { header: "Tipe", key: "type", width: 15 },
      { header: "Target", key: "target", width: 15 },
      { header: "Penjualan Bersih", key: "netSales", width: 15 },
      { header: "Biaya Bagi Bagi POS", key: "costBagiBagiPOS", width: 20 },
      {
        header: "Persentase Bagi Bagi Biaya",
        key: "percentageBagiBagiBiaya",
        width: 25,
      },
      {
        header: "Persentase Bagi Bagi Pendapatan",
        key: "percentageFeePos",
        width: 20,
      },
      { header: "Bagi Bagi Biaya", key: "bagiBagiBiaya", width: 15 },
      { header: "Bagi Bagi Pendapatan", key: "bagiBagiPendapatan", width: 20 },
    ];

    // Gaya untuk header
    const headerStyle = {
      font: { bold: true, color: { argb: "FFFFFF" } },
      fill: { type: "pattern", pattern: "solid", fgColor: { argb: "4472C4" } },
      alignment: { horizontal: "center", vertical: "middle" },
    };

    // Terapkan gaya ke header
    worksheet.getRow(1).eachCell((cell) => {
      cell.style = headerStyle;
    });

    // Format angka
    const numberFormat = "#,##0.00";
    const percentageFormat = '0"%"';

    let rowIndex = 2;
    let grandTotalExcel = {
      netSales: 0,
      costBagiBagiPOS: 0,
      bagiBagiBiaya: 0,
      bagiBagiPendapatan: 0,
    };

    // Tambahkan data per invoice
    Object.entries(groupedTransactions).forEach(([invoice, transactions]) => {
      let invoiceTotal = {
        netSales: 0,
        costBagiBagiPOS: 0,
        bagiBagiBiaya: 0,
        bagiBagiPendapatan: 0,
      };

      transactions.forEach((transaction, index) => {
        const row = worksheet.addRow(transaction);

        // Format angka dan persentase
        row.getCell("netSales").numFmt = numberFormat;
        row.getCell("costBagiBagiPOS").numFmt = numberFormat;
        row.getCell("percentageBagiBagiBiaya").numFmt = percentageFormat;
        row.getCell("percentageFeePos").numFmt = percentageFormat;
        row.getCell("bagiBagiBiaya").numFmt = numberFormat;
        row.getCell("bagiBagiPendapatan").numFmt = numberFormat;

        // Log nilai yang ditambahkan ke Excel untuk memastikan
        // console.log('Excel percentageBagiBagiBiaya:', transaction.percentageBagiBagiBiaya);
        // console.log('Excel percentageFeePos:', transaction.percentageFeePos);

        // Beri warna latar belakang selang-seling
        if (index % 2 === 0) {
          row.eachCell((cell) => {
            cell.fill = {
              type: "pattern",
              pattern: "solid",
              fgColor: { argb: "F2F2F2" },
            };
          });
        }

        // Hitung total per invoice
        invoiceTotal.netSales += transaction.netSales;
        invoiceTotal.costBagiBagiPOS += transaction.costBagiBagiPOS;
        invoiceTotal.bagiBagiBiaya += transaction.bagiBagiBiaya;
        invoiceTotal.bagiBagiPendapatan += transaction.bagiBagiPendapatan;

        rowIndex++;

        // Gaya untuk baris total
        const totalStyle = {
          font: { bold: true },
          fill: {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFC000" },
          },
        };

        // Tambahkan subtotal setelah tipe FEE
        if (transaction.type === "FEE") {
          const subtotalRow = worksheet.addRow({
            invoice: `Subtotal ${invoice}`,
            netSales: "",
            costBagiBagiPOS: "",
            bagiBagiBiaya: invoiceTotal.bagiBagiBiaya,
            bagiBagiPendapatan: invoiceTotal.bagiBagiPendapatan,
          });
          subtotalRow.font = { bold: true };
          subtotalRow.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "E2EFDA" },
          };
          subtotalRow.eachCell((cell, colNumber) => {
            cell.style = totalStyle;
            if (colNumber >= 3 && colNumber <= 11) {
              // Kolom C, D, dan E
              cell.numFmt = numberFormat;
            }
          });
          rowIndex++;

          // Tambahkan ke grand total
          grandTotalExcel.netSales += invoiceTotal.netSales;
          grandTotalExcel.costBagiBagiPOS += invoiceTotal.costBagiBagiPOS;
          grandTotalExcel.bagiBagiBiaya += invoiceTotal.bagiBagiBiaya;
          grandTotalExcel.bagiBagiPendapatan += invoiceTotal.bagiBagiPendapatan;

          // Reset invoice total
          invoiceTotal = {
            netSales: 0,
            costBagiBagiPOS: 0,
            bagiBagiBiaya: 0,
            bagiBagiPendapatan: 0,
          };
        }
      });
    });

    // Tambahkan border ke seluruh tabel
    worksheet.eachRow((row) => {
      row.eachCell((cell) => {
        cell.border = {
          top: { style: "thin" },
          left: { style: "thin" },
          bottom: { style: "thin" },
          right: { style: "thin" },
        };
      });
    });

    // Buat buffer dari workbook
    const buffer = await workbook.xlsx.writeBuffer();

    console.log(totalBagiBagiPendapatan);
    console.log(totalBagiBagiBiaya);
    console.log(totalNetSales);
    totalNetSales = totalBagiBagiPendapatan + totalBagiBagiBiaya;
    return apiResponse(res, 200, "Transaction report fetched successfully", {
      transactions: paginatedTransactionList,
      draw: parseInt(draw),
      recordsTotal: transactionList.length,
      recordsFiltered: paginatedTransactionList.length,
      totalBagiBagiPendapatan: totalNetSales,
      totalBagiBagiBiaya: totalBagiBagiBiaya,
      totalNetSales: totalBagiBagiPendapatan,
      totalTransaction: totalTransaction,
      excelBuffer: buffer.toString("base64"),
    });
  } catch (error) {
    console.log(error);
    return apiResponse(res, 500, "Internal server error", error.message);
  }
};

const reportTransactionV2 = async (req, res) => {
  try {
    const {
      filter,
      trxDatabase,
      targetDatabase,
      startDate,
      endDate,
      start = 0,
      length = 10,
      draw = 1,
    } = req.query;
    let totaltransactionVal = 0;
    let totalDiscount = 0; // total discount
    let totalVA = 0;
    let totalQris = 0;
    let totalCash = 0;
    let totalGrossSales = 0; // total pembelian termasuk fee garapin
    let totalFeePos = 0; // total fee
    let totalNetSales = 0; // total penjualan bersih (total penjualan - total discount - total fee garapin)
    let totalNetSalesAfterShare = 0;
    let totaltotalFee = 0; // total fee bank
    let totalnetRevenueShare = 0; // total penjualan bersih * persentase bagi bagi biaya (persentase diambil dari split payment rule berdasarkan target database)
    let totalTransaksi = 0; // total transaksi

    // Validasi dan konversi tanggal ke format ISO 8601
    if (!startDate || !endDate) {
      return apiResponse(res, 400, "startDate dan endDate diperlukan");
    }

    // Fungsi untuk mengkonversi waktu dari GMT+0 ke GMT+7
    const convertToGMT7 = (date) => {
      return new Date(date.getTime() + 7 * 60 * 60 * 1000);
    };

    // Konversi tanggal ke format ISO 8601
    const startISO = new Date(startDate);
    const endISO = new Date(endDate);

    console.log(startISO);
    console.log(endISO);

    if (isNaN(startISO.getTime()) || isNaN(endISO.getTime())) {
      return apiResponse(res, 400, "Format tanggal tidak valid");
    }

    const db = await connectTargetDatabase(trxDatabase);
    const SplitPaymentRuleData = db.model(
      "Split_Payment_Rule_Id",
      splitPaymentRuleIdScheme
    );
    const TransactionData = db.model("Transaction", transactionSchema);

    // Fungsi untuk memeriksa apakah invoice mengandung QUICK_RELEASE
    const isQuickRelease = (invoice) => {
      return invoice && invoice.includes("QUICK_RELEASE");
    };

    const calculateTotalDiscount = (items) => {
      if (!Array.isArray(items)) {
        return 0; // Kembalikan 0 jika items bukan array
      }
      return items.reduce((total, item) => {
        const discount =
          item.product && item.product.discount ? item.product.discount : 0;
        const quantity = item.quantity || 1;
        return total + discount * quantity;
      }, 0);
    };

    if (filter === "Yearly") {
      const yearStart = new Date(`${startDate}T00:00:00.000Z`);
      const yearEnd = new Date(`${endDate}T23:59:59.999Z`);

      const monthlyData = Array(12)
        .fill()
        .map(() => ({
          grossSales: 0,
          discount: 0,
          netSales: 0,
          biayaFee: 0,
          netAfterShare: 0,
        }));

      const allTransactions = await TransactionData.find({
        createdAt: { $gte: yearStart, $lte: yearEnd },
        status: "SUCCEEDED",
        invoice: { $regex: /^INV-/ },
      });

      const filteredTransactions = allTransactions.filter(
        (transaction) => !isQuickRelease(transaction.invoice)
      );

      const transactionList = await Promise.all(
        filteredTransactions.map(async (transaction) => {
          const month = transaction.createdAt.getMonth();
          const discount =
            transaction.product && transaction.product.items
              ? calculateTotalDiscount(transaction.product.items)
              : 0;
          const grossSales = transaction.total_with_fee;
          const biayaFee = transaction.fee_garapin;
          const netSales = grossSales - discount - biayaFee;

          const splitPaymentRule = await SplitPaymentRuleData.findOne({
            invoice: transaction.invoice,
          });

          let percentageFeePos = 0;
          let netAfterShare = 0;
          if (splitPaymentRule && splitPaymentRule.routes) {
            const route = splitPaymentRule.routes.find(
              (route) => route.reference_id === targetDatabase
            );
            if (route) {
              if (route.percent_amount !== undefined) {
                percentageFeePos = route.percent_amount;
                netAfterShare = netSales * (percentageFeePos / 100);
              } else if (route.flat_amount !== undefined) {
                netAfterShare = route.flat_amount;
              }
            }
          }

          monthlyData[month].grossSales += grossSales;
          monthlyData[month].discount += discount;
          monthlyData[month].netSales += netSales;
          monthlyData[month].settlement_status = transaction.settlement_status;
          monthlyData[month].biayaFee += biayaFee;
          monthlyData[month].netAfterShare += netAfterShare;

          totalGrossSales += grossSales;
          totalDiscount += discount;
          totalNetSales += netSales;
          totalBiayaFee += biayaFee;
          totalNetAfterShare += netAfterShare;
        })
      );

      totalTransaksi = filteredTransactions.length;

      const transactionListYearly = monthlyData.map((data, index) => ({
        date: `${startDate.split("-")[0]}-${(index + 1).toString().padStart(2, "0")}-${startDate.split("-")[2]}`,
        invoice: "",
        settlement_status: data.settlement_status,
        grossSales: data.grossSales,
        discount: data.discount,
        biayaFee: data.biayaFee,
        netSales: data.netSales,
        netAfterShare: data.netAfterShare,
      }));

      // Buat workbook dan worksheet
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Laporan Transaksi");

      // Atur header
      worksheet.columns = [
        { header: "Transaction Date", key: "date", width: 15 },
        { header: "Gross Sales", key: "grossSales", width: 15 },
        { header: "Discount Sales", key: "discount", width: 15 },
        { header: "Biaya Fee", key: "biayaFee", width: 15 },
        { header: "Nett Sales", key: "netSales", width: 15 },
        { header: "Nett After Share", key: "netAfterShare", width: 15 },
      ];

      // Gaya untuk header
      const headerStyle = {
        font: { bold: true, color: { argb: "FFFFFF" } },
        fill: {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "4472C4" },
        },
        alignment: { horizontal: "center", vertical: "middle" },
      };

      // Terapkan gaya ke header
      worksheet.getRow(1).eachCell((cell) => {
        cell.style = headerStyle;
      });

      // Format angka
      const numberFormat = "#,##0.00";

      // Format tanggal dengan jam dan detik
      const dateFormat = "yyyy-MM";

      // Tambahkan data
      transactionListYearly.forEach((transaction, index) => {
        const row = worksheet.addRow(transaction);
        row.getCell("grossSales").numFmt = numberFormat;
        row.getCell("discount").numFmt = numberFormat;
        row.getCell("netSales").numFmt = numberFormat;
        row.getCell("biayaFee").numFmt = numberFormat;
        row.getCell("netAfterShare").numFmt = numberFormat;

        // Format tanggal
        row.getCell("date").numFmt = dateFormat;

        // Beri warna latar belakang selang-seling
        if (index % 2 === 0) {
          row.eachCell((cell) => {
            cell.fill = {
              type: "pattern",
              pattern: "solid",
              fgColor: { argb: "F2F2F2" },
            };
          });
        }
      });

      // Tambahkan total
      const totalRow = worksheet.addRow({
        date: "Total",
        invoice: "",
        grossSales: { formula: `SUM(B2:B${worksheet.rowCount})` },
        discount: { formula: `SUM(C2:C${worksheet.rowCount})` },
        biayaFee: { formula: `SUM(D2:D${worksheet.rowCount})` },
        netSales: { formula: `SUM(E2:E${worksheet.rowCount})` },
        netAfterShare: { formula: `SUM(F2:F${worksheet.rowCount})` },
      });

      // Gaya untuk baris total
      const totalStyle = {
        font: { bold: true },
        fill: {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "E2EFDA" },
        },
      };

      totalRow.eachCell((cell, colNumber) => {
        cell.style = totalStyle;
        if (colNumber >= 3 && colNumber <= 5) {
          // Kolom C, D, dan E
          cell.numFmt = numberFormat;
        }
      });

      // Tambahkan border ke seluruh tabel
      worksheet.eachRow((row) => {
        row.eachCell((cell) => {
          cell.border = {
            top: { style: "thin" },
            left: { style: "thin" },
            bottom: { style: "thin" },
            right: { style: "thin" },
          };
        });
      });

      // Buat buffer dari workbook
      const buffer = await workbook.xlsx.writeBuffer();

      return apiResponse(res, 200, "Transaction report fetched successfully", {
        transactions: transactionListYearly,
        totalGrossSales,
        totalDiscount,
        totalBiayaFee,
        totalNetSales,
        totalNetAfterShare,
        draw: parseInt(draw),
        recordsTotal: allTransactions.length,
        recordsFiltered: transactionList.length,
        excelBuffer: buffer.toString("base64"),
      });
    }

    // Hitung total records dan total sales
    const allTransactions = await TransactionData.find({
      createdAt: { $gte: startISO, $lte: endISO },
      status: "SUCCEEDED",
      invoice: { $regex: /^INV-/ },
    });

    // console.log(allTransactions);

    // Transaksi murni tanpa invoice QUICK_RELEASE
    const filteredTransactions = allTransactions.filter(
      (transaction) => !isQuickRelease(transaction.invoice)
    );

    filteredTransactions.forEach((transaction) => {
      const discount =
        transaction.product && transaction.product.items
          ? calculateTotalDiscount(transaction.product.items)
          : 0;

      const transactionVal = transaction.total_with_fee + discount;
      const grossSales = transactionVal - discount;

      // const netSales = grossSales - discount - transaction.fee_garapin;
      totalVA +=
        transaction.payment_method === "VIRTUAL_ACCOUNT"
          ? transaction.total_with_fee
          : 0;
      totalQris +=
        transaction.payment_method === "QR_QODE"
          ? transaction.total_with_fee
          : 0;
      totalCash +=
        transaction.payment_method === "CASH" ? transaction.total_with_fee : 0;
      totalGrossSales += grossSales;
      totalDiscount += discount;
      totalFeePos += transaction.fee_garapin;
      totaltransactionVal += transactionVal;
      // totalNetSales += netSales;
    });

    totalTransaksi = filteredTransactions.length;

    // Ambil data dengan pagination
    const transactions = await TransactionData.find({
      createdAt: { $gte: startISO, $lte: endISO },
      status: "SUCCEEDED",
      invoice: { $regex: /^INV-/ },
    })
      .skip(parseInt(start))
      .limit(parseInt(length));

    const filteredTrx = allTransactions.filter(
      (transaction) => !isQuickRelease(transaction.invoice)
    );

    const transactionList = await Promise.all(
      filteredTrx.map(async (transaction) => {
        const discount =
          transaction.product && transaction.product.items
            ? calculateTotalDiscount(transaction.product.items)
            : 0;

        const transactionVal = transaction.total_with_fee + discount;
        const grossSales = transactionVal - discount;

        const splitPaymentRule = await SplitPaymentRuleData.findOne({
          invoice: transaction.invoice,
        });
        let netSales = 0;
        let percentageFeePos = 0;
        let netAfterShare = 0;
        let netRevenueShare = 0;
        let totalFee = 0;
        let fee = 0;
        let feeGarapin = 0;
        if (splitPaymentRule && splitPaymentRule.routes) {
          const route = splitPaymentRule.routes.find(
            (route) => route.reference_id === targetDatabase
          );
          if (route) {
            if (route.percent_amount !== undefined) {
              percentageFeePos = route.percent_amount;
              totalFee = route.totalFee;
              feeGarapin = transaction.fee_garapin;
              fee = transaction.fee_garapin;
              netSales = grossSales - fee;
              netAfterShare = netSales * (percentageFeePos / 100);
              netRevenueShare = netAfterShare - totalFee;
            } else if (route.flat_amount !== undefined) {
              netAfterShare = route.flat_amount - feeBank - feePos;
            }
          }
        }
        totaltotalFee += totalFee;
        totalNetSales += netSales;
        totalNetSalesAfterShare += netAfterShare;
        totalnetRevenueShare += netRevenueShare;

        return {
          date: transaction.createdAt,
          invoice: transaction.invoice_label,
          settlement_status: transaction.settlement_status,
          payment_method:
            transaction.payment_method === "VIRTUAL_ACCOUNT"
              ? "VA"
              : transaction.payment_method === "QR_QODE"
                ? "QRIS"
                : "CASH",
          transactionVal,
          discount,
          grossSales,
          fee,
          netSales,
          netAfterShare,
          totalFee,
          netRevenueShare,
        };
      })
    );

    // Buat workbook dan worksheet
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Laporan Transaksi");
    const numberFormat = `"Rp" #,##0`; // Format Rupiah tanpa desimal
    const dateFormat = "dd-mmm-yyyy hh:mm:ss"; // Format tanggal dengan nama bulan singkat
    for (let i = 0; i < 5; i++) {
      worksheet.addRow([]);
    }

    worksheet.getRow(1).values = [
      "TOTAL TRANSACTION VALUE",
      "TOTAL DISKON",
      "PAYMENT VA",
      "PAYMENT QRIS",
      "PAYMENT CASH",
      "GROSS SALES",
      "TOTAL TRANSACTION",
      "TOTAL BIAYA BAGIBAGIPOS",
      "NETT SALES",
      "GROSS SALES AFTER SHARE",
      "BIAYA QRIS/VA + VAT",
      "NETT SALES AFTER SHARE",
    ];

    worksheet.getRow(2).values = [
      totaltransactionVal,
      totalDiscount,
      totalVA,
      totalQris,
      totalCash,
      totalGrossSales,
      totalTransaksi,
      totalFeePos,
      totalNetSales,
      totalNetSalesAfterShare,
      totaltotalFee,
      totalnetRevenueShare,
    ];

    const row = worksheet.getRow(2);

    // Kolom yang memerlukan format Rupiah
    row.getCell(1).numFmt = numberFormat; // totaltransactionVal
    row.getCell(2).numFmt = numberFormat; // totalDiscount
    row.getCell(3).numFmt = numberFormat; // totalGrossSales
    row.getCell(4).numFmt = numberFormat; // totalGrossSales
    row.getCell(5).numFmt = numberFormat; // totalFeePos
    row.getCell(6).numFmt = numberFormat; // totalNetSales
    row.getCell(8).numFmt = numberFormat; // totaltotalFee
    row.getCell(9).numFmt = numberFormat; // totalnetRevenueShare
    row.getCell(10).numFmt = numberFormat; // totalnetRevenueShare
    row.getCell(11).numFmt = numberFormat; // totalnetRevenueShare
    row.getCell(12).numFmt = numberFormat; // totalnetRevenueShare
    worksheet.getRow(3).values = [
      "Total Nilai Transaksi sebelum dipotong diskon.",
      "Total Nilai Transaksi Menggunakan Pembayaran Virtual Account",
      "Total Nilai Transaksi Menggunakan Pembayaran QRIS",
      "Total Nilai Transaksi Menggunakan Pembayaran Cash",
      "Total Diskon terhadap produk",
      "Total nilai struk atau total nilai uang masuk termasuk biaya bagibagiPOS",
      "Jumlah Transaksi",
      "Biaya per transaksi",
      "Gross Sales dikurangi Biaya POS ",
      "Total Pendapatan Kotor sesuai dengan pembagian pendapatan.",
      "Biaya Bank atas pembayaran QRIS / VA, ditambah dengan pajak QRIS/VA",
      "Pendapatan bersih sudah dipotong biaya bank dan akan/sudah di transfer ke masing-masing wallet account",
    ];

    const row3 = worksheet.getRow(3);
    row3.eachCell((cell) => {
      cell.alignment = {
        wrapText: true, // Membuat teks otomatis terbungkus
        vertical: "top", // Mengatur teks berada di bagian atas sel (opsional)
      };
    });

    // Atur header
    worksheet.getRow(6).values = [
      "TRANSACTION DATE",
      "INVOICE #",
      "SETTLEMENT STATUS",
      "PAYMENT METHOD",
      "TRANSACTION VALUE",
      "DISKON",
      "GROSS SALES",
      "BIAYA BAGIBAGIPOS",
      "NETT SALES",
      "GROSS SALES AFTER SHARE",
      "BIAYA QRIS/VA + VAT",
      "NETT SALES AFTER SHARE",
    ];

    // Menentukan lebar kolom
    worksheet.columns = [
      { key: "date", width: 25 }, // Lebar diperbesar untuk tanggal
      { key: "invoice", width: 30 },
      { key: "settlement_status", width: 15 },
      { key: "payment_method", width: 15 },
      { key: "transactionVal", width: 15 },
      { key: "discount", width: 15 },
      { key: "grossSales", width: 15 },
      { key: "fee", width: 15 },
      { key: "netSales", width: 15 },
      { key: "netAfterShare", width: 15 },
      { key: "totalFee", width: 15 },
      { key: "netRevenueShare", width: 15 },
    ];

    // Gaya untuk header
    const headerStylebiru = {
      font: { bold: true, color: { argb: "FFFFFF" } },
      fill: { type: "pattern", pattern: "solid", fgColor: { argb: "4472C4" } },
      alignment: { horizontal: "center", vertical: "middle" },
    };

    const headerStylemerah = {
      font: { bold: true, color: { argb: "FFFFFF" } },
      fill: {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF0000" },
      },
      alignment: { horizontal: "center", vertical: "middle" },
    };

    const headerStylehijau = {
      font: { bold: true, color: { argb: "000000" } },
      fill: {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "79c97a" },
      },
      alignment: { horizontal: "center", vertical: "middle" },
    };

    worksheet.getRow(1).getCell(1).style = headerStylebiru;
    worksheet.getRow(1).getCell(2).style = headerStylemerah;
    worksheet.getRow(1).getCell(3).style = headerStylebiru;
    worksheet.getRow(1).getCell(4).style = headerStylebiru;
    worksheet.getRow(1).getCell(5).style = headerStylebiru;
    worksheet.getRow(1).getCell(6).style = headerStylebiru;
    worksheet.getRow(1).getCell(7).style = headerStylebiru;
    worksheet.getRow(1).getCell(8).style = headerStylemerah;
    worksheet.getRow(1).getCell(9).style = headerStylebiru;
    worksheet.getRow(1).getCell(10).style = headerStylehijau;
    worksheet.getRow(1).getCell(11).style = headerStylemerah;
    worksheet.getRow(1).getCell(12).style = headerStylehijau;

    for (let i = 1; i <= 5; i++) {
      worksheet.getRow(6).getCell(i).style = headerStylebiru;
    }

    worksheet.getRow(6).getCell(6).style = headerStylemerah;
    worksheet.getRow(6).getCell(7).style = headerStylebiru;
    worksheet.getRow(6).getCell(8).style = headerStylemerah;
    worksheet.getRow(6).getCell(9).style = headerStylebiru;
    worksheet.getRow(6).getCell(10).style = headerStylehijau;
    worksheet.getRow(6).getCell(11).style = headerStylemerah;
    worksheet.getRow(6).getCell(12).style = headerStylehijau;

    // Terapkan gaya ke header

    // Format angka

    // Tambahkan data
    transactionList.forEach((transaction, index) => {
      const row = worksheet.addRow(transaction);
      row.getCell("transactionVal").numFmt = numberFormat;
      row.getCell("discount").numFmt = numberFormat;
      row.getCell("grossSales").numFmt = numberFormat;
      row.getCell("fee").numFmt = numberFormat;
      row.getCell("netSales").numFmt = numberFormat;
      row.getCell("netAfterShare").numFmt = numberFormat;
      row.getCell("totalFee").numFmt = numberFormat;
      row.getCell("netRevenueShare").numFmt = numberFormat;

      // Format tanggal
      row.getCell("date").numFmt = dateFormat;

      // Beri warna latar belakang selang-seling
      if (index % 2 === 0) {
        row.eachCell((cell) => {
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "F2F2F2" },
          };
        });
      }
    });

    // // Tambahkan total
    // const totalRow = worksheet.addRow({
    //   date: "Total",
    //   invoice: "",
    //   settlement_status: "",
    //   transactionVal: { formula: `SUM(D2:D${worksheet.rowCount})` },
    //   discount: { formula: `SUM(E2:E${worksheet.rowCount})` },
    //   grossSales: { formula: `SUM(F2:F${worksheet.rowCount})` },
    //   fee: { formula: `SUM(G2:G${worksheet.rowCount})` },
    //   netSales: { formula: `SUM(H2:H${worksheet.rowCount})` },
    //   netRevenueShare: { formula: `SUM(I2:I${worksheet.rowCount})` },
    //   totalFee: { formula: `SUM(J2:J${worksheet.rowCount})` },
    //   netAfterShare: { formula: `SUM(K2:K${worksheet.rowCount})` },
    // });

    // Gaya untuk baris total
    // const totalStyle = {
    //   font: { bold: true },
    //   fill: { type: "pattern", pattern: "solid", fgColor: { argb: "E2EFDA" } },
    // };

    // totalRow.eachCell((cell, colNumber) => {
    //   cell.style = totalStyle;
    //   if (colNumber >= 3 && colNumber <= 5) {
    //     // Kolom C, D, dan E
    //     cell.numFmt = numberFormat;
    //   }
    // });

    // Tambahkan border ke seluruh tabel
    worksheet.eachRow((row) => {
      row.eachCell((cell) => {
        cell.border = {
          top: { style: "thin" },
          left: { style: "thin" },
          bottom: { style: "thin" },
          right: { style: "thin" },
        };
      });
    });

    // Buat buffer dari workbook
    const buffer = await workbook.xlsx.writeBuffer();

    return apiResponse(res, 200, "Transaction report fetched successfully", {
      transactions: transactionList,
      totaltransactionVal,
      totalDiscount,
      totalVA,
      totalQris,
      totalCash,
      totalGrossSales,
      totalFeePos,
      totalNetSales,
      totalNetSalesAfterShare,
      totaltotalFee,
      totalnetRevenueShare,
      totalTransaksi,
      draw: parseInt(draw),
      recordsTotal: allTransactions.length,
      recordsFiltered: transactions.length,
      excelBuffer: buffer.toString("base64"),
    });
  } catch (error) {
    console.log(error);
    return apiResponse(res, 500, "Internal server error", error.message);
  }
};

const reportTransactionItem = async (req, res) => {
  try {
    const targetDatabase = req.get("target-database");

    if (!targetDatabase) {
      return apiResponse(res, 400, "Target database is not specified");
    }

    const { start_date, end_date, export_excel } = req.query;

    // Validasi parameter tanggal
    if (!start_date || !end_date) {
      return apiResponse(res, 400, "Start date and end date are required");
    }

    // Konversi tanggal dari GMT+7 ke GMT+0
    const startDateGMT0 = new Date(
      new Date(start_date).getTime() - 7 * 60 * 60 * 1000
    );
    const endDateGMT0 = new Date(
      new Date(end_date).getTime() - 7 * 60 * 60 * 1000
    );

    const db = await connectTargetDatabase(targetDatabase);
    const transactionModelStore = db.model("Transaction", transactionSchema);

    const transactionDetails = await transactionModelStore.aggregate([
      // Filter berdasarkan tanggal transaksi
      {
        $match: {
          settlement_status: "SETTLED",
          createdAt: { $gte: startDateGMT0, $lte: endDateGMT0 },
        },
      },
      // Membuka array `product.items` menjadi dokumen individual
      {
        $unwind: "$product.items",
      },
      // Menghitung total_price_item untuk setiap item dan mengelompokkan per hari
      {
        $group: {
          _id: {
            date: {
              $dateToString: { format: "%Y-%m-%d", date: "$payment_date" },
            },
            product_sku: "$product.items.product.sku",
            product_name: "$product.items.product.name",
          },
          total_price_item: {
            $sum: {
              $multiply: [
                "$product.items.quantity",
                "$product.items.product.price",
              ],
            },
          },
          quantity: { $sum: "$product.items.quantity" },
        },
      },
      // Mengelompokkan per tanggal untuk menghitung total harga seluruh item
      {
        $group: {
          _id: "$_id.date",
          day: { $first: "$_id.date" },
          items: {
            $push: {
              product_sku: "$_id.product_sku",
              product_name: "$_id.product_name",
              total_price_item: "$total_price_item",
              quantity: "$quantity",
            },
          },
          total_price: { $sum: "$total_price_item" },
        },
      },
      // Menyiapkan data dalam format akhir
      {
        $project: {
          _id: 0,
          day: 1,
          total_price: 1,
          items: 1,
        },
      },
    ]);

    // Jika parameter export_excel = true, ekspor data ke Excel dan kirim sebagai base64
    if (export_excel === "true") {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Transactions");

      // Menambahkan header
      worksheet.columns = [
        { header: "Date", key: "day", width: 15 },
        { header: "Product SKU", key: "product_sku", width: 15 },
        { header: "Product Name", key: "product_name", width: 30 },
        { header: "Total Price Item", key: "total_price_item", width: 20 },
        { header: "Quantity", key: "quantity", width: 15 },
        { header: "Total Price", key: "total_price", width: 15 },
      ];

      // Menambahkan data ke worksheet
      transactionDetails.forEach((transaction) => {
        // Menambahkan item transaksi
        transaction.items.forEach((item) => {
          worksheet.addRow({
            day: transaction.day,
            product_sku: item.product_sku,
            product_name: item.product_name,
            total_price_item: item.total_price_item,
            quantity: item.quantity,
          });
        });

        // Menambahkan baris total untuk setiap tanggal di bawah item yang terkait

        worksheet.addRow({
          day: transaction.day,
          total_price: transaction.total_price,
        }).font = { bold: true }; // Membuat baris total harga menjadi tebal
      });
      worksheet.addRow({}); // Baris pemisah kosong
      // Mengonversi workbook ke buffer dan kemudian ke base64
      const buffer = await workbook.xlsx.writeBuffer();
      const base64Excel = buffer.toString("base64");

      return apiResponse(res, 200, "Excel file generated successfully", {
        file: base64Excel,
        file_name: "Transaction_Report.xlsx",
      });
    }

    // Jika export_excel tidak diminta, kirim data biasa
    return apiResponse(res, 200, "Transaction report fetched successfully", {
      transactions: transactionDetails,
    });
  } catch (error) {
    return apiResponse(res, 500, "An error occurred", { error: error.message });
  }
};

export default {
  reportTransaction,
  reportTransactionByPaymentMethod,
  reportTransactionByProduct,
  reportBagiBagi,
  reportTransactionV2,
  reportTransactionItem,
};
