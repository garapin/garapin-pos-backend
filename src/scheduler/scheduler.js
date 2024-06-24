import cron from 'node-cron';
import TransactionEngine from '../engines/transactionEngine.js';
import Logger from '../utils/logger.js';
import 'dotenv/config';
import CashPaymentEngine from '../engines/cashPaymentEngine.js';

const transactionEngine = new TransactionEngine();
const cashPaymentEngine = new CashPaymentEngine();

function setupCronJobs() {
    const schedule = process.env.CRON_SCHEDULE || '0 * * * *';
    cron.schedule(schedule, () => {
        Logger.log('Menjalankan cron job VA and QRIS checked Transaction');
        transactionEngine.getXenditTransaction();
    });
}

export default setupCronJobs;