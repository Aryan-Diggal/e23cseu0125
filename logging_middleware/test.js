const { Log } = require("./logger");

async function runTests() {
  await Log("backend", "info", "config", "Logging middleware initialized successfully");
  await Log("backend", "debug", "middleware", "Testing debug level log");
  await Log("backend", "warn", "service", "Testing warning level log");
  await Log("backend", "error", "handler", "Testing error level log");
  await Log("backend", "fatal", "db", "Testing fatal level log");
}

runTests();