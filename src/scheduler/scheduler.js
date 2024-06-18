import cron from 'node-cron';
import TransactionEngine from '../engines/transactionEngine.js';
import Logger from '../utils/logger.js';
import 'dotenv/config';

const transactionEngine = new TransactionEngine();

function setupCronJobs() {
    const schedule = process.env.CRON_SCHEDULE || '0 * * * *';
    cron.schedule(schedule, () => {
        Logger.log('Menjalankan cron job');
        transactionEngine.getXenditTransaction();
    });
}

export default setupCronJobs;