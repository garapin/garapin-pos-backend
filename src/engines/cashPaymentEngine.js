import axios from "axios";
import cron from 'node-cron';
import 'dotenv/config';
import { DatabaseModel } from "../models/databaseModel.js";
import { storeSchema } from "../models/storeModel.js";
import { transactionSchema } from "../models/transactionModel.js";
import { splitPaymentRuleIdScheme } from "../models/splitPaymentRuleIdModel.js";
import Logger from "../utils/logger.js";
import { RouteRole, StatusStore } from "../config/enums.js";
import { connectTargetDatabase } from "../config/targetDatabase.js";

class CashPaymentEngine {
    constructor() {
        if (CashPaymentEngine.instance) {
            return CashPaymentEngine.instance;
        }

        this.apiKey = process.env.XENDIT_API_KEY;
        this.baseUrl = 'https://api.xendit.co';
        this.cronJobs = new Map(); // Menyimpan referensi cron job berdasarkan database TRX

        CashPaymentEngine.instance = this;
    }


    async checkPaymentCash(target_db) {
        // const allStore = await this.getAllStore();
        // for (const store of allStore) {
        //     const transactionStore = await this.getTransactionStoreTypeByDatabase(store.db_name);
        // }
        Logger.log(`Waiting cron job for ${target_db}`);
        this.startCronJob(target_db);
        const transactionStore = await this.getTransactionStoreTypeByDatabase(target_db);
    }

    async getBalance(store) {
        const url = `${this.baseUrl}/balance`;
        return axios.get(url, {
            headers: {
                'Authorization': `Basic ${Buffer.from(this.apiKey + ":").toString("base64")}`,
                'for-user-id': store.account_holder.id
            },
        });
    }

    // async getAllStore() {
    //     const allStore = await DatabaseModel.find({ db_parent: { $exists: true } });
    //     return allStore;
    // }

    async getTransactionStoreTypeByDatabase(target_database) {
        let db = null;
        try {
            db = await connectTargetDatabase(target_database);
            const StoreModelInStoreDatabase = db.model('Store', storeSchema);
            const storeData = await StoreModelInStoreDatabase.find({
                merchant_role: 'TRX'
            });

            for (const store of storeData) {
                // Check Balance
                const balance = await this.getBalance(store);

                // Check Transaction List
                const TransactionModel = db.model("Transaction", transactionSchema);
                const transactionList = await TransactionModel.find({
                    status: "PENDING_TRANSFER",
                    payment_method: "CASH",
                });

                /// Cek jika jam sudah melebihi jam 11.30 PM
                const currentTime = new Date();
                const cutoffTime = new Date();
                cutoffTime.setHours(23, 30, 0); // Set waktu cutoff menjadi 11.30 PM
                if (currentTime > cutoffTime) {
                    const updateStoreStatus = await StoreModelInStoreDatabase.findOneAndUpdate(
                        { merchant_role: RouteRole.TRX },
                        { $set: { store_status: StatusStore.LOCKED } }
                    );

                    Logger.log("Waktu sudah melebihi 11.30 PM, menghentikan proses.");
                    this.stopCronJob(target_database);
                    return;
                }

                // STOP CRON IF TRANSACTION LIST IS EMPTY
                if (transactionList.length === 0) {

                    if (store.store_status === StatusStore.PENDING_ACTIVE || store.store_status === StatusStore.LOCKED) {
                        const updateStoreStatus = await StoreModelInStoreDatabase.findOneAndUpdate(
                            { merchant_role: RouteRole.TRX },
                            { $set: { store_status: StatusStore.ACTIVE } }
                        );
                    }

                    this.stopCronJob(target_database);
                    return;
                }

                for (const transaction of transactionList) {
                    const TemplateModel = db.model('Split_Payment_Rule_Id', splitPaymentRuleIdScheme);
                    const template = await TemplateModel.findOne({ invoice: transaction.invoice });

                    if (balance.data.balance >= transaction.total_with_fee) {
                        for (const route of template.routes) {
                            if (route.destination_account_id !== store.account_holder.id) {
                                Logger.log(`Routing to ${route.destination_account_id} for transaction ${transaction.invoice}`);
                                Logger.log(`Store ${store.account_holder.id} has enough balance Rp ${balance.data.balance} for transaction ${transaction.invoice} Rp ${transaction.total_with_fee}`);
                                await this.checkAndSplitTransaction(route, transaction, store.account_holder.id, target_database);
                            }
                        }
                    } else {
                        Logger.log(`Store ${store.account_holder.id} has no balance for transaction ${transaction.invoice}`);
                    }
                }
            }
        } catch (error) {
            Logger.errorLog("Gagal menghubungkan ke database", error);
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
                reference_id: transaction.invoice + "&&" + route.reference_id
            }
        });
    }

    async checkAndSplitTransaction(route, transaction, source_user_id, target_db) {
        const transactionDestination = await this.fetchTransactionDestination(route, transaction);
        if (transactionDestination.data.data.length === 0) {
            Logger.log(`Sources id ${source_user_id}`);
            Logger.log(`Transaction ${transaction.invoice + "&&" + route.reference_id} has not been split yet`);
            await this.splitTransaction(route, transaction, source_user_id, target_db);
        } else {
            Logger.log(`Transaction ${transaction.invoice} has already been split`);
        }
    }

    async splitTransaction(route, transaction, source_user_id, target_db) {
        const transferBody = {
            amount: route.flat_amount,
            source_user_id: source_user_id,
            destination_user_id: route.destination_account_id,
            reference: transaction.invoice + "&&" + route.reference_id
        };

        try {
            const postTransfer = await axios.post(`${this.baseUrl}/transfers`, transferBody, {
                headers: {
                    'Authorization': `Basic ${Buffer.from(this.apiKey + ":").toString("base64")}`,
                    'Content-Type': 'application/json'
                }
            });

            if (postTransfer.status === 200) {
                Logger.log(`Transaction ${transaction.invoice + "&&" + route.reference_id} successfully split`);
                this.updateTransaction(transaction, target_db);
            } else {
                Logger.log(`Failed to split transaction ${transaction.invoice + "&&" + route.reference_id}`);
            }
        } catch (error) {
            Logger.errorLog("Error during transaction split", error);
        }
    }

    async updateTransaction(transaction, target_db) {
        const db = await connectTargetDatabaseForEngine(target_db);
        const TransactionModel = db.model("Transaction", transactionSchema);
        await TransactionModel.updateOne({ invoice: transaction.invoice }, { status: "SUCCEEDED" });
    }

    startCronJob(targetDatabase) {
        if (!this.cronJobs.has(targetDatabase)) {
            const schedule = process.env.CRON_SCHEDULE || '0 * * * *';
            const job = cron.schedule(schedule, () => {
                Logger.log(`Running cron job for ${targetDatabase}`);
                this.checkPaymentCash(targetDatabase);
            });

            this.cronJobs.set(targetDatabase, job);
            Logger.log(`Cron job started for ${targetDatabase}`);
        } else {
            Logger.log(`Cron job already scheduled for ${targetDatabase}`);
        }
    }

    stopCronJob(targetDatabase) {
        if (this.cronJobs.has(targetDatabase)) {
            const job = this.cronJobs.get(targetDatabase);
            job.stop();
            this.cronJobs.delete(targetDatabase);
            Logger.log(`Cron job stopped for ${targetDatabase}`);
        }
    }
}

export default CashPaymentEngine;