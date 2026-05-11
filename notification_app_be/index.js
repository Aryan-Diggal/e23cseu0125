const express = require("express");
const { Log } = require("../logging_middleware/logger");
const notificationRoutes = require("./routes/notifications");

const app = express();
const PORT = 3002;

app.use(express.json());
app.use("/notifications", notificationRoutes);

app.listen(PORT, async () => {
  await Log("backend", "info", "config", `Notification service running on port ${PORT}`);
  console.log(`Server running on http://localhost:${PORT}`);
});