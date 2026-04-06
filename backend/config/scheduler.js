import cron from 'node-cron';
import { batchComputeAllRecommendations } from '../jobs/batchRecommendations.js';

let scheduledJob = null;

/**
 * Initialize the batch recommendation job scheduler
 * Default: Runs daily at 2 AM
 * Can be customized via environment variables
 */
const initScheduler = () => {
  const cronExpression = process.env.BATCH_CRON_SCHEDULE || '0 2 * * *'; // 2 AM daily

  console.log('\n🕐 SCHEDULER INITIALIZATION');
  console.log(`   Cron expression: ${cronExpression}`);
  console.log('   Next run will be calculated by node-cron');

  // Create the scheduled job
  scheduledJob = cron.schedule(cronExpression, async () => {
    console.log('\n⏰ Scheduled batch recommendation job triggered!');
    try {
      await batchComputeAllRecommendations({
        k: 10,
        batchSize: parseInt(process.env.BATCH_SIZE || '50'),
        skipCache: false,
        saveToDB: true,
        saveToRedis: true,
      });
      console.log('✅ Batch job completed successfully');
    } catch (error) {
      console.error('❌ Batch job error:', error.message);
    }
  });

  console.log('✅ Scheduler initialized\n');
  return scheduledJob;
};

/**
 * Get the current scheduled job
 */
const getScheduler = () => {
  return scheduledJob;
};

/**
 * Stop the scheduler
 */
const stopScheduler = async () => {
  if (scheduledJob) {
    scheduledJob.stop();
    scheduledJob.destroy();
    console.log('🛑 Scheduler stopped');
    scheduledJob = null;
  }
};

/**
 * Manually trigger batch computation
 * Can be called from API endpoint
 */
const manuallyTriggerBatch = async (options = {}) => {
  console.log('🚀 Manual batch trigger');
  return await batchComputeAllRecommendations({
    k: options.k || 10,
    batchSize: options.batchSize || 50,
    skipCache: options.skipCache || false,
    saveToDB: options.saveToDB !== false,
    saveToRedis: options.saveToRedis !== false,
  });
};

export { initScheduler, getScheduler, stopScheduler, manuallyTriggerBatch };
