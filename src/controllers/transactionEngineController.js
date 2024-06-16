import axios from "axios";
import 'dotenv/config';
import { TransactionXenditResponse } from "../models/transactionXenditModel.js";
import { splitPaymentRuleIdScheme } from "../models/splitPaymentRuleIdModel.js";
import { connectTargetDatabase } from "../config/targetDatabase.js";

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
            console.error("Gagal mengambil transaksi:", error.response ? error.response.status : error.message);
        }
    }

    async fetchTransactions(url) {
        return axios.get(url, {
            headers: {
                'Authorization': `Basic ${Buffer.from(this.apiKey + ":").toString("base64")}`,
                'for-user-id': this.accountId
            }
        });
    }

    async processTransactions(response) {
        for (const transactionData of response.data.data) {
            const transaction = new TransactionXenditResponse(transactionData);
            console.log(transaction.reference_id);

            if (transaction.settlement_status === "SETTLED" && transaction.cashflow === "MONEY_IN") {
                await this.handleSettledTransaction(transaction);
            }
        }
    }

    async handleSettledTransaction(transaction) {
        const referenceId = transaction.reference_id;
        const parts = referenceId.split("&&");
        const databasePart = parts[1];

        const storeDatabase = await connectTargetDatabase(databasePart);
        const TemplateModel = storeDatabase.model('Split_Payment_Rule_Id', splitPaymentRuleIdScheme);
        const template = await TemplateModel.findOne({ invoice: transaction.reference_id });

        for (const route of template.routes) {
            if (route.destination_account_id !== this.accountId) {
                console.log("Not Parent Wallet");
                console.log("Ini nama routing", route.destination_account_id);
                await this.checkAndSplitTransaction(route, transaction);
            }
        }
    }

    async checkAndSplitTransaction(route, transaction) {
        const transactionDestination = await this.fetchTransactionDestination(route, transaction);
        if (transactionDestination.data.data.length === 0) {
            console.log("Transaksi BELUM SPLIT");
            await this.splitTransaction(route, transaction);
        } else {
            console.log(`Transaksi ${transaction.reference_id} sudah SPLIT`);
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
                reference_id: transaction.reference_id
            }
        });
    }

    async splitTransaction(route, transaction) {
        const transferBody = {
            amount: route.flat_amount,
            source_user_id: this.accountId,
            destination_user_id: route.destination_account_id,
            reference: transaction.reference_id
        };

        try {
            const postTransfer = await axios.post(`${this.baseUrl}/transfers`, transferBody, {
                headers: {
                    'Authorization': `Basic ${Buffer.from(this.apiKey + ":").toString("base64")}`,
                    'Content-Type': 'application/json'
                }
            });

            if (postTransfer.status === 200) {
                console.log("Transaksi berhasil di SPLIT");
            } else {
                console.log("Transaksi gagal di SPLIT");
            }
        } catch (error) {
            if (error.response) {
                console.error("Error fetching transactions:", error.response.status, error.response.data.message);
            } else if (error.request) {
                console.error("No response received:", error.request);
            } else {
                console.error("Error setting up request:", error.message);
            }
        }
    }
}

export default TransactionEngine;
