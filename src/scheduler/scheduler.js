import cron from "node-cron";
import TransactionEngine from "../engines/transactionEngine.js";
import Logger from "../utils/logger.js";
import "dotenv/config";
import CashPaymentEngine from "../engines/cashPaymentEngine.js";
import AnotherEngine from "../engines/anotherEngine.js";

const anotherEngine = new AnotherEngine();
const transactionEngine = new TransactionEngine();
const cashPaymentEngine = new CashPaymentEngine();

function setupCronJobs() {
  // const schedule = process.env.CRON_SCHEDULE || "0 * * * *";
  // cron.schedule(schedule, () => {
  //   Logger.log("Menjalankan cron job VA and QRIS checked Transaction");
  //   transactionEngine.getXenditTransaction();
  // });

  // Schedule for rak
  // "0 0 * * *" midnight
  // "*/5 * * * *"; every 5 menit
  // "0 * * * *" every hours
  const scheduleUpdateAndCheckRack = "*/1 * * * *";
  cron.schedule(scheduleUpdateAndCheckRack, () => {
    Logger.log("Running cron job for check Available Rak");
    anotherEngine.schedulerStatusRakEngine();
  });

  // // Schedule for transaction
  // const scheduleUpdateAndCheckTransaction = "*/1 * * * *";
  // cron.schedule(scheduleUpdateAndCheckTransaction, () => {
  //   Logger.log("Running cron job for check Available Rak");
  //   anotherEngine.schedulerStatusTransactionEngine();
  // });
  // Schedule for update position
  // const scheduleUpdatePosition = "*/1 * * * *";
  // cron.schedule(scheduleUpdatePosition, () => {
  //   Logger.log("Running cron job for check Available Position");
  //   anotherEngine.schedulerStatusPosition();
  // });
}

export default setupCronJobs;
