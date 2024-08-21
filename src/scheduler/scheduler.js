import cron from "node-cron";
import Logger from "../utils/logger.js";
import "dotenv/config";
import AnotherEngine from "../engines/anotherEngine.js";

const anotherEngine = new AnotherEngine();

function setupCronJobs() {

  // Schedule for rak
  // "0 0 * * *" midnight
  // "*/5 * * * *"; every 5 menit
  // "0 * * * *" every hours
  // const scheduleUpdateAndCheckRack = "0 0 * * *";
  // cron.schedule(scheduleUpdateAndCheckRack, () => {
  //   Logger.log("Running cron job for check Available Rak");
  //   anotherEngine.schedulerStatusRakEngine();
  // });
}

export default setupCronJobs;
