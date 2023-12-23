import { PrismaTypes, Context as DbContext } from "@lib/db";
import axios from "axios";
import { ConnectionOptions, Job, Queue, Worker } from "bullmq";
import { config } from "@lib/config";

interface AppJob {
  endpoint: PrismaTypes.Endpoint;
  job?: Job;
  error?: any;
}

interface LivenessConstructorOptions {
  concurrency?: number;
  queueName?: string;
  ctx: DbContext;
  timeout?: number;
}

export class Liveness {
  private queue: Queue;
  private worker: Worker;
  private ctx: DbContext;
  private redisConnectionConfig: ConnectionOptions;

  constructor(options: LivenessConstructorOptions) {
    const {
      concurrency = 10,
      queueName = "LIVENESS_CHECKER",
      ctx,
      timeout
    } = options;
    if (!ctx) throw new Error("Missing ctx option");
    this.ctx = ctx;
    this.redisConnectionConfig = config.redisConnectionConfig;
    this.queue = new Queue(queueName, {
      connection: this.redisConnectionConfig
    });
    this.queue.on("error", (err) => console.error("Queue error", err));
    const liveness = this;
    this.worker = new Worker(queueName, check, {
      concurrency,
      connection: this.redisConnectionConfig
    });
    this.worker.on("error", (err) => console.error("Worker error", err));

    async function check(job: Job): Promise<void> {
      const endpoint: PrismaTypes.Endpoint = job.data;
      if (!endpoint) return;

      const reportCreateData: {
        endpointId: string;
        errorMessage?: string;
        errorCode?: string;
        status?: number;
        response?: any;
      } = {
        endpointId: endpoint.id
      };

      try {
        const res = await axios({
          url: endpoint.url,
          method: endpoint.type,
          data: endpoint.body,
          timeout
        });
        reportCreateData.status = res.status;
        reportCreateData.response = res.data;
      } catch (error: any) {
        if (error.response) {
          reportCreateData.status = error.response.status;
        }
        reportCreateData.errorMessage = error.message;
        reportCreateData.errorCode = error.code;
      }
      const res = await liveness.ctx.prisma.report.create({
        data: reportCreateData
      });
      // console.log("Report added", res);
    }
  }

  public async start(): Promise<AppJob[]> {
    // await this.queue.obliterate({ force: true });

    const jobs = [];

    const endpoints = await this.ctx.prisma.endpoint.findMany({
      where: {
        Resource: {
          some: {}
        }
      },
      include: {
        Resource: {
          where: {
            active: true
          },
          orderBy: [
            {
              frequency: "asc"
            }
          ],
          take: 1
        }
      }
    });

    for await (const endpoint of endpoints) {
      const resource = endpoint.Resource[0];
      try {
        const job = await this.queue.add(endpoint.id, endpoint, {
          repeat: {
            every: Number(resource.frequency)
          }
        });
        jobs.push({
          endpoint,
          job
        });
      } catch (error) {
        jobs.push({
          endpoint,
          error
        });
      }
    }

    return jobs;
  }

  public async stop(): Promise<void> {
    const repeatableJobs = await this.queue.getRepeatableJobs();
    for await (const job of repeatableJobs) {
      await this.queue.removeRepeatableByKey(job.key);
    }
    await this.queue.drain();
    // await this.queue.obliterate({ force: true });
    // console.log(repeatableJobs);
    const counts = await this.queue.getJobCounts("wait", "completed", "failed");
    await this.worker.close();
    await this.queue.close();
  }
}
