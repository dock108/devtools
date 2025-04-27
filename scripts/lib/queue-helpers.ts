// scripts/lib/queue-helpers.ts
import { queue } from '@/lib/queue'; // Assuming this path resolves correctly

export async function waitForQueueDrained(timeoutMs = 15000): Promise<void> {
  console.log(`Waiting for BullMQ queue '${queue.name}' to drain...`);
  const start = Date.now();
  while (true) {
    try {
      const counts = await queue.getJobCounts();
      const { waiting, active, delayed } = counts;
      const total = waiting + active + delayed;
      console.log(
        `  Queue status: Waiting=${waiting}, Active=${active}, Delayed=${delayed} (Total: ${total})`,
      );

      if (total === 0) {
        console.log(`Queue drained successfully after ${Date.now() - start}ms.`);
        return;
      }

      if (Date.now() - start > timeoutMs) {
        throw new Error(
          `Queue did not drain within the ${timeoutMs}ms timeout. Counts: ${JSON.stringify(counts)}`,
        );
      }

      // Check more frequently initially, then back off slightly
      const waitTime = Date.now() - start < 5000 ? 250 : 500;
      await new Promise((resolve) => setTimeout(resolve, waitTime));
    } catch (error) {
      console.error(`Error checking queue status: ${error.message}`);
      // Decide if we should retry or re-throw
      if (Date.now() - start > timeoutMs) {
        throw new Error(`Queue status check failed repeatedly and timed out: ${error.message}`);
      }
      await new Promise((resolve) => setTimeout(resolve, 1000)); // Wait longer after an error
    }
  }
}

// Optional: Add a function to connect/disconnect the queue if needed for the script
// export async function connectQueue() {
//   // Implementation depends on how the queue instance is managed
//   if (!queue.client || !queue.client.isOpen) {
//      await queue.waitUntilReady(); // Or explicit connect method if available
//      console.log('Queue client connected.');
//   }
// }

// export async function disconnectQueue() {
//    await queue.close();
//    console.log('Queue client disconnected.');
// }
