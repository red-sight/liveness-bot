import { config } from "@lib/config";
import { PrismaClient } from "@prisma/client";

export type * as PrismaTypes from "@prisma/client";
export type { Prisma } from "@prisma/client";

export { Context, MockContext, createMockContext } from "./context";

export const prisma = new PrismaClient({
  datasourceUrl: config.dbUrl
});
