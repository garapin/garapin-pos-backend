import axios from "axios";
import 'dotenv/config';
import { splitPaymentRuleIdScheme } from "../models/splitPaymentRuleIdModel.js";
import { connectTargetDatabase, connectTargetDatabaseForEngine } from "../config/targetDatabase.js";
import Logger from "../utils/logger.js";
import { Cashflow, ChannelCategory, RouteRole, SettlementStatus } from "../config/enums.js";
import { ConfigTransactionModel } from "../models/configTransaction.js";

class TransactionEngine {
    constructor() {
        this.apiKey = process.env.XENDIT_API_KEY;
        this.accountId = process.env.XENDIT_ACCOUNT_GARAPIN;
        this.baseUrl = 'https://api.xendit.co';
    }

    async getXenditTransaction() {
        const url = `${this.baseUrl}/transactions`;
        try {
            const response = await this.fetchTransactions(url);
            await this.processTransactions(response);
        } catch (error) {
            Logger.errorLog("Gagal mengambil transaksi", error);
        }
    }

    async fetchTransactions(url) {
        return axios.get(url, {
            headers: {
                'Authorization': `Basic ${Buffer.from(this.apiKey + ":").toString("base64")}`,
                'for-user-id': this.accountId
            },
            params: {
                'limit': 50,
                'channel_categories': [ChannelCategory.VA, ChannelCategory.QR],
            }
        });
    }

    async processTransactions(response) {
        for (const transactionData of response.data.data) {
            const transaction = transactionData;

            if (this.isValidReferenceId(transaction.reference_id) && transaction.settlement_status === SettlementStatus.SETTLED && transaction.cashflow === Cashflow.MONEY_IN) {
                Logger.log(`\nProcessing transaction ${transaction.reference_id}`);
                try {
                    await this.handleSettledTransaction(transaction);
                } catch (error) {
                    Logger.errorLog("Gagal menghubungkan ke database atau memproses transaksi", error);
                }
            }
        }
    }

    isValidReferenceId(referenceId) {
        return /^INV-/.test(referenceId);
    }

    async handleSettledTransaction(transaction) {
        const referenceId = transaction.reference_id;
        const parts = referenceId.split("&&");
        const databasePart = parts[1];
        let storeDatabase = null;

        try {
            storeDatabase = await connectTargetDatabaseForEngine(databasePart);
            const TemplateModel = storeDatabase.model('Split_Payment_Rule_Id', splitPaymentRuleIdScheme);
            const template = await TemplateModel.findOne({ invoice: transaction.reference_id });

            for (const route of template.routes) {
                if (route.destination_account_id !== this.accountId) {
                    Logger.log(`Routing to ${route.destination_account_id} for transaction ${transaction.reference_id}`);
                    await this.checkAndSplitTransaction(route, transaction);
                }
            }
        } catch (error) {
            Logger.errorLog("Gagal menghubungkan ke database", error);
        } finally {
            if (storeDatabase) {
                storeDatabase.close(); // Menutup koneksi database
                Logger.log("Database connection closed.");
            }
        }
    }

    async checkAndSplitTransaction(route, transaction) {
        const transactionDestination = await this.fetchTransactionDestination(route, transaction);
        if (transactionDestination.data.data.length === 0) {
            Logger.log(`Transaction ${transaction.reference_id} has not been split yet`);
            await this.splitTransaction(route, transaction);
        } else {
            Logger.log(`Transaction ${transaction.reference_id} has already been split`);
        }
    }

    async fetchTransactionDestination(route, transaction) {
        const url = `${this.baseUrl}/transactions`;
        return axios.get(url, {
            headers: {
                'Authorization': `Basic ${Buffer.from(this.apiKey + ":").toString("base64")}`,
                'for-user-id': route.destination_account_id
            },
            params: {
                reference_id: transaction.reference_id + "&&" + route.reference_id
            }
        });
    }

    async splitTransaction(route, transaction) {
        var totalFee = 0;
        if (transaction.channel_category === ChannelCategory.VA) {
            const configTransaction = await ConfigTransactionModel.findOne({
                type: "VA",
            });

            const feeBank = configTransaction.fee_flat;
            const vat = Math.floor(feeBank * (configTransaction.vat_percent / 100));
            totalFee = feeBank + vat;
        } else if (transaction.channel_category === ChannelCategory.QR) {
            const configTransaction = await ConfigTransactionModel.findOne({
                type: "QRIS",
            });

            const feeBank = Math.floor(
                transaction.amount * (configTransaction.fee_percent / 100)
            );
            const vat = Math.floor(feeBank * (configTransaction.vat_percent / 100));
            totalFee = feeBank + vat;
        }

        const transferBody = {
            amount: route.role === RouteRole.TRX ? route.flat_amount - totalFee : route.flat_amount,
            source_user_id: this.accountId,
            destination_user_id: route.destination_account_id,
            reference: transaction.reference_id + "&&" + route.reference_id
        };

        try {
            const postTransfer = await axios.post(`${this.baseUrl}/transfers`, transferBody, {
                headers: {
                    'Authorization': `Basic ${Buffer.from(this.apiKey + ":").toString("base64")}`,
                    'Content-Type': 'application/json'
                }
            });

            if (postTransfer.status === 200) {
                Logger.log(`Transaction ${transaction.reference_id} successfully split`);
            } else {
                Logger.log(`Failed to split transaction ${transaction.reference_id}`);
            }
        } catch (error) {
            Logger.errorLog("Error during transaction split", error);
        }
    }
}

export default TransactionEngine;
