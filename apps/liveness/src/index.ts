import { Liveness } from "./Liveness";
import { prisma } from "@lib/db";

const liveness = new Liveness({
  ctx: {
    prisma
  }
});

liveness.start();
