import Path from "path";

if (process.env.PROJECT_CWD) {
  process.env.NODE_CONFIG_TS_DIR = `${process.env.PROJECT_CWD}/packages/config/config`;
  require("dotenv").config({
    path: Path.join(process.env.PROJECT_CWD, ".env")
  });
}

export const { config } = require("node-config-ts");
