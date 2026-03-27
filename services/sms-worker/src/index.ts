import { Worker, Job } from "bullmq";
import IORedis from "ioredis";
import { prisma } from "@autoerebus/database";

const connection = new IORedis(process.env.REDIS_URL || "redis://localhost:6379", {
  maxRetriesPerRequest: null,
});

interface SmsJob {
  to: string;
  message: string;
  type: string;
  metadata?: Record<string, unknown>;
}

async function sendSms(to: string, message: string): Promise<string> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_PHONE_NUMBER;

  if (!accountSid || !authToken || !from) {
    throw new Error("Twilio credentials not configured");
  }

  // Dynamic import to avoid issues when twilio is not configured
  const twilio = await import("twilio");
  const client = twilio.default(accountSid, authToken);

  const result = await client.messages.create({ body: message, from, to });
  return result.sid;
}

const worker = new Worker<SmsJob>(
  "sms",
  async (job: Job<SmsJob>) => {
    const { to, message, type } = job.data;
    console.log(`Processing SMS job ${job.id}: ${type} -> ${to}`);

    try {
      const sid = await sendSms(to, message);

      await prisma.smsLog.create({
        data: {
          to,
          message,
          status: "sent",
          provider: "twilio",
        },
      });

      console.log(`SMS sent successfully: ${sid}`);
      return { sid, status: "sent" };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";

      await prisma.smsLog.create({
        data: {
          to,
          message,
          status: "failed",
          provider: "twilio",
          error: errorMessage,
        },
      });

      throw error;
    }
  },
  {
    connection,
    concurrency: 5,
    limiter: { max: 10, duration: 1000 },
  }
);

worker.on("completed", (job) => {
  console.log(`SMS job ${job.id} completed`);
});

worker.on("failed", (job, err) => {
  console.error(`SMS job ${job?.id} failed:`, err.message);
});

console.log("SMS Worker started, waiting for jobs...");
