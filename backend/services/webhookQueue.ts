/**
 * Webhook Job Queue Service
 * 
 * Uses BullMQ + Redis for persistent, reliable processing of incoming Tatum webhooks.
 * 
 * Architecture:
 * 1. tatumCryptoWebHook (thin handler) → enqueues raw payload to "tatum-webhooks" queue → returns 200 immediately
 * 2. Worker picks up job → runs full processing logic (duplicate check, crypto verification, merchant webhook, etc.)
 * 3. On failure: BullMQ retries with exponential backoff (3 attempts: 5s, 30s, 120s)
 * 4. After max retries: job moves to dead-letter queue for manual review
 * 5. On startup: reconciliation service checks for missed webhooks and re-queues them
 */

import { Queue, Worker, Job, QueueEvents } from "bullmq";
import { webhookLogs } from "../utils/loggers";
import { captureError } from "./errorMonitoringService";

// Redis connection config (reuse from environment)
const REDIS_URL = process.env.REDIS_PUBLIC_URL || "redis://localhost:6379";

function parseRedisUrl(url: string) {
  const parsed = new URL(url);
  return {
    host: parsed.hostname,
    port: parseInt(parsed.port, 10) || 6379,
    password: parsed.password || undefined,
    username: parsed.username && parsed.username !== "default" ? parsed.username : undefined,
  };
}

const redisConnection = parseRedisUrl(REDIS_URL);

// ── Queue Definition ──────────────────────────────────────────────────────────
export const webhookQueue = new Queue("tatum-webhooks", {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 5000, // 5s, 30s, 120s
    },
    removeOnComplete: {
      age: 86400, // Keep completed jobs for 24h (for debugging)
      count: 1000, // Max 1000 completed jobs
    },
    removeOnFail: false, // Keep failed jobs for review
  },
});

// ── Dead Letter Queue ─────────────────────────────────────────────────────────
export const deadLetterQueue = new Queue("tatum-webhooks-dlq", {
  connection: redisConnection,
  defaultJobOptions: {
    removeOnComplete: false,
    removeOnFail: false,
  },
});

// ── Job Data Interface ────────────────────────────────────────────────────────
export interface WebhookJobData {
  payload: {
    address: string;
    counterAddress?: string;
    amount: string | number;
    txId: string;
    asset?: string;
    [key: string]: unknown;
  };
  queryParams: {
    company_id?: number;
    user_id?: number;
    address_id?: number;
  };
  receivedAt: string;
  source: "webhook" | "reconciliation";
}

// ── Enqueue Webhook ───────────────────────────────────────────────────────────
export async function enqueueWebhook(
  data: WebhookJobData,
  options?: { priority?: number; jobId?: string }
): Promise<string> {
  const jobId = options?.jobId || `tx-${data.payload.txId}-${Date.now()}`;
  
  const job = await webhookQueue.add("process-webhook", data, {
    jobId,
    priority: options?.priority || 0,
  });

  webhookLogs.info(`[WebhookQueue] Enqueued job ${job.id} for tx ${data.payload.txId}`);
  return job.id;
}

// ── Worker (started separately via startWebhookWorker) ────────────────────────
let worker: Worker | null = null;

export function startWebhookWorker(
  processFunction: (data: WebhookJobData) => Promise<void>
): Worker {
  if (worker) {
    webhookLogs.info("[WebhookQueue] Worker already running, skipping duplicate start");
    return worker;
  }

  worker = new Worker(
    "tatum-webhooks",
    async (job: Job<WebhookJobData>) => {
      webhookLogs.info(`[WebhookQueue] Processing job ${job.id} (attempt ${job.attemptsMade + 1}/${job.opts.attempts})`);
      
      try {
        await processFunction(job.data);
        webhookLogs.info(`[WebhookQueue] Job ${job.id} completed successfully`);
      } catch (error: unknown) {
        const err = error as Error;
        webhookLogs.error(`[WebhookQueue] Job ${job.id} failed: ${err.message}`);
        throw error; // BullMQ handles retry
      }
    },
    {
      connection: redisConnection,
      concurrency: 5, // Process up to 5 webhooks in parallel
      limiter: {
        max: 10,
        duration: 1000, // Max 10 jobs per second (avoid overwhelming Tatum API)
      },
    }
  );

  // ── Event Handlers ──────────────────────────────────────────────────────────
  worker.on("completed", (job: Job) => {
    webhookLogs.info(`[WebhookQueue] Job ${job.id} completed`);
  });

  worker.on("failed", async (job: Job | undefined, error: Error) => {
    if (!job) return;
    
    const attemptsLeft = (job.opts.attempts || 3) - job.attemptsMade;
    
    if (attemptsLeft <= 0) {
      // Max retries exhausted → move to DLQ
      webhookLogs.error(`[WebhookQueue] Job ${job.id} EXHAUSTED all retries. Moving to DLQ.`);
      
      try {
        await deadLetterQueue.add("failed-webhook", {
          ...job.data,
          failedAt: new Date().toISOString(),
          error: error.message,
          attempts: job.attemptsMade,
          originalJobId: job.id,
        });
        
        captureError(error, "webhook-queue", {
          severity: "high",
          requestContext: `DLQ: tx=${job.data.payload.txId}`,
          extraContext: `Job ${job.id} failed after ${job.attemptsMade} attempts`,
        });
      } catch (dlqError) {
        webhookLogs.error(`[WebhookQueue] Failed to add job to DLQ: ${(dlqError as Error).message}`);
      }
    } else {
      webhookLogs.warn(`[WebhookQueue] Job ${job.id} failed (${attemptsLeft} retries left): ${error.message}`);
    }
  });

  worker.on("error", (error: Error) => {
    webhookLogs.error(`[WebhookQueue] Worker error: ${error.message}`);
  });

  webhookLogs.info("[WebhookQueue] Worker started (concurrency: 5)");
  return worker;
}

// ── Queue Health / Monitoring ─────────────────────────────────────────────────
export async function getQueueHealth(): Promise<{
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  dlq: number;
  isPaused: boolean;
}> {
  const [waiting, active, completed, failed, delayed, dlqWaiting] = await Promise.all([
    webhookQueue.getWaitingCount(),
    webhookQueue.getActiveCount(),
    webhookQueue.getCompletedCount(),
    webhookQueue.getFailedCount(),
    webhookQueue.getDelayedCount(),
    deadLetterQueue.getWaitingCount(),
  ]);

  return {
    waiting,
    active,
    completed,
    failed,
    delayed,
    dlq: dlqWaiting,
    isPaused: await webhookQueue.isPaused(),
  };
}

// ── Get DLQ Items for Review ──────────────────────────────────────────────────
export async function getDLQItems(start = 0, end = 20): Promise<Job[]> {
  return deadLetterQueue.getJobs(["waiting", "failed"], start, end);
}

// ── Retry a DLQ Item ──────────────────────────────────────────────────────────
export async function retryDLQItem(jobId: string): Promise<boolean> {
  const jobs = await deadLetterQueue.getJobs(["waiting", "failed"]);
  const job = jobs.find((j) => j.id === jobId || j.data?.originalJobId === jobId);

  if (!job) {
    webhookLogs.error(`[WebhookQueue] DLQ job not found: ${jobId}`);
    return false;
  }

  // Re-enqueue to main queue
  await enqueueWebhook(job.data, { priority: 1 });
  await job.remove();
  
  webhookLogs.info(`[WebhookQueue] DLQ job ${jobId} re-queued for processing`);
  return true;
}

// ── Graceful Shutdown ─────────────────────────────────────────────────────────
export async function shutdownWebhookQueue(): Promise<void> {
  webhookLogs.info("[WebhookQueue] Shutting down...");
  
  if (worker) {
    await worker.close();
    worker = null;
  }
  await webhookQueue.close();
  await deadLetterQueue.close();
  
  webhookLogs.info("[WebhookQueue] Shutdown complete");
}
