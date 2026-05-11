const express = require("express");
const router = express.Router();
const { Log } = require("../../logging_middleware/logger");
const {
  getAllNotifications,
  getNotificationById,
  createNotification,
  updateNotification,
  deleteNotification,
  markAsRead
} = require("../controllers/notificationController");

router.use(async (req, res, next) => {
  await Log("backend", "info", "route", `${req.method} ${req.originalUrl}`);
  next();
});

router.get("/", getAllNotifications);
router.get("/:id", getNotificationById);
router.post("/", createNotification);
router.put("/:id", updateNotification);
router.delete("/:id", deleteNotification);
router.patch("/:id/read", markAsRead);

module.exports = router;