import { Worker, Job } from "bullmq";
import IORedis from "ioredis";
import { Resend } from "resend";
import { prisma } from "@autoerebus/database";

const connection = new IORedis(process.env.REDIS_URL || "redis://localhost:6379", {
  maxRetriesPerRequest: null,
});

const resend = new Resend(process.env.RESEND_API_KEY);
const EMAIL_FROM = process.env.EMAIL_FROM || "noreply@autoerebus.ro";

interface EmailJob {
  to: string;
  subject: string;
  html: string;
  type: string;
  metadata?: Record<string, unknown>;
}

const worker = new Worker<EmailJob>(
  "email",
  async (job: Job<EmailJob>) => {
    const { to, subject, html, type } = job.data;
    console.log(`Processing email job ${job.id}: ${type} -> ${to}`);

    try {
      const result = await resend.emails.send({
        from: EMAIL_FROM,
        to,
        subject,
        html,
      });

      await prisma.emailLog.create({
        data: {
          to,
          subject,
          status: "sent",
          provider: "resend",
        },
      });

      console.log(`Email sent successfully: ${result.data?.id}`);
      return { id: result.data?.id, status: "sent" };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";

      await prisma.emailLog.create({
        data: {
          to,
          subject,
          status: "failed",
          provider: "resend",
          error: errorMessage,
        },
      });

      throw error;
    }
  },
  {
    connection,
    concurrency: 10,
    limiter: { max: 50, duration: 1000 },
  }
);

worker.on("completed", (job) => {
  console.log(`Email job ${job.id} completed`);
});

worker.on("failed", (job, err) => {
  console.error(`Email job ${job?.id} failed:`, err.message);
});

console.log("Email Worker started, waiting for jobs...");
