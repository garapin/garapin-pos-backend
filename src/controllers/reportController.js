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
      { header: "Persentase Fee POS", key: "percentageFeePos", width: 20 },
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

    let totalGrossSales = 0; // total pembelian termasuk fee garapin
    let totalDiscount = 0; // total discount
    let totalNetSales = 0; // total penjualan bersih (total penjualan - total discount - total fee garapin)
    let totalBiayaFee = 0; // total biaya fee
    let totalTransaksi = 0; // total transaksi
    let totalNetAfterShare = 0; // total penjualan bersih * persentase bagi bagi biaya (persentase diambil dari split payment rule berdasarkan target database)

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

      const transactionList = await Promise.all(filteredTransactions.map(async (transaction) => {
        const month = transaction.createdAt.getMonth();
        const discount =
          transaction.product && transaction.product.items
            ? calculateTotalDiscount(transaction.product.items)
            : 0;
        const grossSales = transaction.total_with_fee
        const biayaFee = transaction.fee_garapin
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
      }));

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

    // Transaksi murni tanpa invoice QUICK_RELEASE
    const filteredTransactions = allTransactions.filter(
      (transaction) => !isQuickRelease(transaction.invoice)
    );

    filteredTransactions.forEach((transaction) => {
      const discount =
        transaction.product && transaction.product.items
          ? calculateTotalDiscount(transaction.product.items)
          : 0;
      const grossSales = transaction.total_with_fee;
      const netSales = grossSales - discount - transaction.fee_garapin;
      const biayaFee = transaction.fee_garapin;

      totalGrossSales += grossSales;
      totalDiscount += discount;
      totalNetSales += netSales;
      totalBiayaFee += biayaFee;
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
        const grossSales = transaction.total_with_fee;
        const netSales = grossSales - discount - transaction.fee_garapin;
        const biayaFee = transaction.fee_garapin;

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

        totalNetAfterShare += netAfterShare;

        return {
          date: transaction.createdAt,
          invoice: transaction.invoice_label,
          settlement_status: transaction.settlement_status,
          grossSales,
          discount,
          biayaFee,
          netSales,
          netAfterShare,
        };
      })
    );

    // Buat workbook dan worksheet
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Laporan Transaksi");

    // Atur header
    worksheet.columns = [
      { header: "Transaction Date", key: "date", width: 15 },
      { header: "Invoice", key: "invoice", width: 30 },
      { header: "Settlement Status", key: "settlement_status", width: 15 },
      { header: "Gross Sales", key: "grossSales", width: 15 },
      { header: "Discount Sales", key: "discount", width: 15 },
      { header: "Biaya Fee", key: "biayaFee", width: 15 },
      { header: "Nett Sales", key: "netSales", width: 15 },
      { header: "Nett After Share", key: "netAfterShare", width: 15 },
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
      settlement_status: "",
      grossSales: { formula: `SUM(D2:D${worksheet.rowCount})` },
      discount: { formula: `SUM(E2:E${worksheet.rowCount})` },
      biayaFee: { formula: `SUM(F2:F${worksheet.rowCount})` },
      netSales: { formula: `SUM(G2:G${worksheet.rowCount})` },
      netAfterShare: { formula: `SUM(H2:H${worksheet.rowCount})` },
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
      totalBiayaFee,
      totalNetAfterShare,
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

export default {
  reportTransaction,
  reportTransactionByPaymentMethod,
  reportTransactionByProduct,
  reportBagiBagi,
  reportTransactionV2,
};
