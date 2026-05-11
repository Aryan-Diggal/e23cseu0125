const express = require("express");
const axios = require("axios");
const { Log } = require("../logging_middleware/logger");

const app = express();
const PORT = 3001;

const TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJNYXBDbGFpbXMiOnsiYXVkIjoiaHR0cDovLzIwLjI0NC41Ni4xNDQvZXZhbHVhdGlvbi1zZXJ2aWNlIiwiZW1haWwiOiJlMjNjc2V1MDEyNUBiZW5uZXR0LmVkdS5pbiIsImV4cCI6MTc3ODQ4NTI0NywiaWF0IjoxNzc4NDg0MzQ3LCJpc3MiOiJBZmZvcmQgTWVkaWNhbCBUZWNobm9sb2dpZXMgUHJpdmF0ZSBMaW1pdGVkIiwianRpIjoiZjVlZTdlOTUtOGY1MC00YjQ4LTlkZmQtNmFjZDJlYmNiYWY4IiwibG9jYWxlIjoiZW4tSU4iLCJuYW1lIjoiYXJ5YW4gZGlnZ2FsIiwic3ViIjoiMDQxNTQ4MGItZmJjMS00ZjVlLTljNzUtNmFmYWYwMWFiNzcxIn0sImVtYWlsIjoiZTIzY3NldTAxMjVAYmVubmV0dC5lZHUuaW4iLCJuYW1lIjoiYXJ5YW4gZGlnZ2FsIiwicm9sbE5vIjoiZTIzY3NldTAxMjUiLCJhY2Nlc3NDb2RlIjoiVGZEeGdyIiwiY2xpZW50SUQiOiIwNDE1NDgwYi1mYmMxLTRmNWUtOWM3NS02YWZhZjAxYWI3NzEiLCJjbGllbnRTZWNyZXQiOiJ5R21obVRyVHVFWmRjd0dOIn0.Y2uRXxwoGPW0gmFw8fxtS_Uc-jzo7ruoeHznGoHLICg";
const BASE_URL = "http://4.224.186.213/evaluation-service";
const headers = { Authorization: `Bearer ${TOKEN}` };

function knapsack(vehicles, capacity) {
  const n = vehicles.length;
  const dp = Array.from({ length: n + 1 }, () => new Array(capacity + 1).fill(0));

  for (let i = 1; i <= n; i++) {
    const { Duration, Impact } = vehicles[i - 1];
    for (let w = 0; w <= capacity; w++) {
      dp[i][w] = dp[i - 1][w];
      if (Duration <= w) {
        dp[i][w] = Math.max(dp[i][w], dp[i - 1][w - Duration] + Impact);
      }
    }
  }

  let w = capacity;
  const selected = [];
  for (let i = n; i > 0; i--) {
    if (dp[i][w] !== dp[i - 1][w]) {
      selected.push(vehicles[i - 1]);
      w -= vehicles[i - 1].Duration;
    }
  }

  return { maxImpact: dp[n][capacity], selectedVehicles: selected };
}

app.get("/schedule", async (req, res) => {
  try {
    await Log("backend", "info", "route", "GET /schedule called");

    const [depotsRes, vehiclesRes] = await Promise.all([
      axios.get(`${BASE_URL}/depots`, { headers }),
      axios.get(`${BASE_URL}/vehicles`, { headers })
    ]);

    const depots = depotsRes.data.depots;
    const vehicles = vehiclesRes.data.vehicles;

    await Log("backend", "info", "service", `Fetched ${depots.length} depots and ${vehicles.length} vehicles`);

    const results = depots.map((depot) => {
      const { maxImpact, selectedVehicles } = knapsack(vehicles, depot.MechanicHours);
      return {
        depotID: depot.ID,
        mechanicHoursBudget: depot.MechanicHours,
        totalImpact: maxImpact,
        totalDuration: selectedVehicles.reduce((sum, v) => sum + v.Duration, 0),
        vehiclesScheduled: selectedVehicles
      };
    });

    await Log("backend", "info", "service", "Knapsack scheduling completed for all depots");
    res.json({ success: true, results });
  } catch (err) {
    await Log("backend", "error", "handler", `Scheduling failed: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, async () => {
  await Log("backend", "info", "config", `Vehicle scheduler running on port ${PORT}`);
  console.log(`Server running on http://localhost:${PORT}`);
});