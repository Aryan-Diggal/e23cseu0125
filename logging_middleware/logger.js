const axios = require("axios");
const config = require("./config");

const VALID_STACKS = ["backend", "frontend"];
const VALID_LEVELS = ["debug", "info", "warn", "error", "fatal"];
const VALID_PACKAGES = [
  "cache", "controller", "cron_job", "db", "domain",
  "handler", "repository", "route", "service",
  "auth", "config", "middleware", "utils"
];

async function Log(stack, level, pkg, message) {
  if (!VALID_STACKS.includes(stack)) {
    throw new Error(`Invalid stack: ${stack}`);
  }
  if (!VALID_LEVELS.includes(level)) {
    throw new Error(`Invalid level: ${level}`);
  }
  if (!VALID_PACKAGES.includes(pkg)) {
    throw new Error(`Invalid package: ${pkg}`);
  }

  try {
    const res = await axios.post(
      config.baseUrl,
      { stack, level, package: pkg, message },
      {
        headers: {
          Authorization: `Bearer ${config.accessToken}`,
          "Content-Type": "application/json"
        }
      }
    );
    console.log(`[${level.toUpperCase()}] ${pkg} - ${message} | logID: ${res.data.logID}`);
    return res.data;
  } catch (err) {
    console.error(`[LOG FAILED] ${err.message}`);
    throw err;
  }
}

module.exports = { Log };