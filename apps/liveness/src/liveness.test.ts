import { Liveness } from "./Liveness";
import {
  prisma,
  Context,
  MockContext,
  createMockContext,
  Prisma,
  PrismaTypes
} from "@lib/db";
import { randomUUID as uuid } from "node:crypto";
import express, { Express, Request } from "express";
import { Http2ServerRequest } from "node:http2";

describe("Liveness class", () => {
  let mockCtx: MockContext;
  let ctx: Context;

  beforeEach(() => {
    mockCtx = createMockContext();
    ctx = mockCtx as unknown as Context;
    jest.clearAllMocks();
  });

  it("check a single server, status 200", async () => {
    const server = new ExpressServer({ port: 3618 });
    await server.up();

    const endpointId = uuid();

    const endpoints: Prisma.EndpointGetPayload<{
      include: { Resource: true };
    }>[] = [
      {
        id: endpointId,
        url: `http://localhost:${server.port}`,
        type: "GET",
        body: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        Resource: [
          {
            id: uuid(),
            chatId: "001",
            name: "My localhost resource",
            endpointId,
            frequency: 10,
            userId: uuid(),
            active: true,
            createdAt: new Date(),
            updatedAt: new Date()
          }
        ]
      }
    ];

    mockCtx.prisma.endpoint.findMany.mockResolvedValue(endpoints);

    const liveness = new Liveness({ ctx, concurrency: 1 });
    await liveness.start();
    await pause(50);
    expect(mockCtx.prisma.endpoint.findMany).toHaveBeenCalled();
    expect(mockCtx.prisma.report.create).toHaveBeenCalledWith({
      data: {
        endpointId,
        response: {
          success: true
        },
        status: 200
      }
    });

    await liveness.stop();
    await server.down();
  });

  it("check a single server, timeout error", async () => {
    const endpointId = uuid();

    const endpoints: Prisma.EndpointGetPayload<{
      include: { Resource: true };
    }>[] = [
      {
        id: endpointId,
        url: `http://localhost:3678`,
        type: "GET",
        body: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        Resource: [
          {
            id: uuid(),
            chatId: "001",
            name: "My localhost resource",
            endpointId,
            frequency: 10,
            userId: uuid(),
            active: true,
            createdAt: new Date(),
            updatedAt: new Date()
          }
        ]
      }
    ];

    mockCtx.prisma.endpoint.findMany.mockResolvedValue(endpoints);

    const liveness = new Liveness({ ctx, concurrency: 1 });
    await liveness.start();
    await pause(50);
    expect(mockCtx.prisma.endpoint.findMany).toHaveBeenCalled();
    expect(mockCtx.prisma.report.create).toHaveBeenCalledWith({
      data: {
        endpointId,
        errorCode: "ECONNREFUSED",
        errorMessage: "connect ECONNREFUSED 127.0.0.1:3678"
      }
    });

    await liveness.stop();
  });

  it("check a single server, error 404", async () => {
    const server = new ExpressServer({
      port: 3618,
      status: 404,
      response: "Not found"
    });
    await server.up();

    const endpointId = uuid();

    const endpoints: Prisma.EndpointGetPayload<{
      include: { Resource: true };
    }>[] = [
      {
        id: endpointId,
        url: `http://localhost:${server.port}`,
        type: "GET",
        body: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        Resource: [
          {
            id: uuid(),
            chatId: "001",
            name: "My localhost resource",
            endpointId,
            frequency: 10,
            userId: uuid(),
            active: true,
            createdAt: new Date(),
            updatedAt: new Date()
          }
        ]
      }
    ];

    mockCtx.prisma.endpoint.findMany.mockResolvedValue(endpoints);
    mockCtx.prisma.report.create.mockImplementation();

    const liveness = new Liveness({ ctx, concurrency: 1 });
    await liveness.start();
    await pause(50);
    expect(mockCtx.prisma.endpoint.findMany).toHaveBeenCalled();
    expect(mockCtx.prisma.report.create).toHaveBeenCalledWith({
      data: {
        endpointId,
        errorCode: "ERR_BAD_REQUEST",
        errorMessage: "Request failed with status code 404",
        status: 404
      }
    });

    await liveness.stop();
    await server.down();
  });

  it("check multiple servers", async () => {
    const pool = new ServersPool([{ port: 3611 }, { port: 2435, status: 403 }]);
    await pool.upAll();

    const firstEndpointId = uuid();
    const secondEndpointId = uuid();

    const endpoints: Prisma.EndpointGetPayload<{
      include: { Resource: true };
    }>[] = [
      {
        id: firstEndpointId,
        url: `http://localhost:${pool.servers[0].port}`,
        type: "GET",
        body: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        Resource: [
          {
            id: uuid(),
            chatId: "001",
            name: "Working resource",
            endpointId: firstEndpointId,
            frequency: 10,
            userId: uuid(),
            active: true,
            createdAt: new Date(),
            updatedAt: new Date()
          }
        ]
      },
      {
        id: secondEndpointId,
        url: `http://localhost:${pool.servers[1].port}`,
        type: "GET",
        body: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        Resource: [
          {
            id: uuid(),
            chatId: "003",
            name: "Resource 2",
            endpointId: secondEndpointId,
            frequency: 10,
            userId: uuid(),
            active: true,
            createdAt: new Date(),
            updatedAt: new Date()
          }
        ]
      }
    ];
    mockCtx.prisma.endpoint.findMany.mockResolvedValue(endpoints);
    mockCtx.prisma.report.create.mockImplementation();

    const liveness = new Liveness({ ctx, concurrency: 2 });
    await liveness.start();
    await pause(30);
    expect(mockCtx.prisma.endpoint.findMany).toHaveBeenCalled();
    expect(mockCtx.prisma.report.create).toHaveBeenCalledWith({
      data: {
        endpointId: firstEndpointId,
        status: 200,
        response: {
          success: true
        }
      }
    });
    expect(mockCtx.prisma.report.create).toHaveBeenCalledWith({
      data: {
        endpointId: secondEndpointId,
        status: 403,
        errorCode: "ERR_BAD_REQUEST",
        errorMessage: "Request failed with status code 403"
      }
    });

    await liveness.stop();
    await pool.downAll();
  });
});

function pause(timeout: number): Promise<void> {
  return new Promise((resolve) => setTimeout(() => resolve(), timeout));
}

interface ExpressServerCreateOtps {
  port: number;
  response?: any;
  method?: string;
  status?: number;
}

class ExpressServer {
  app;
  server: any;
  public port: number;

  constructor({
    port,
    response = { success: true },
    method = "GET",
    status = 200
  }: ExpressServerCreateOtps) {
    this.app = express();
    this.app.use("/", (req, res, next) => {
      if (req.method === method) return res.status(status).send(response);
      return next();
    });

    this.port = port;
  }

  public async up(): Promise<ExpressServer> {
    return new Promise((resolve, reject) => {
      this.server = this.app.listen(this.port, () => {
        return resolve(this);
      });
      this.server.on("error", (err: any) => {
        console.error(err);
        return reject(err);
      });
    });
  }

  public async down(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server.close((err: any) => {
        if (err) return reject(err);
        resolve();
      });
    });
  }
}

class ServersPool {
  public servers: ExpressServer[];

  constructor(servers: ExpressServerCreateOtps[]) {
    this.servers = servers.map((server) => new ExpressServer(server));
  }

  async upAll(): Promise<ExpressServer[]> {
    return Promise.all(this.servers.map((server) => server.up()));
  }

  async downAll(): Promise<void[]> {
    return Promise.all(this.servers.map((server) => server.down()));
  }
}
