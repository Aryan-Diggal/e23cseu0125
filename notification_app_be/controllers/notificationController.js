const { v4: uuidv4 } = require("uuid");
const { Log } = require("../../logging_middleware/logger");


let notifications = [];

const getAllNotifications = async (req, res) => {
  
  await Log("backend", "info", "controller", "Fetching all notifications");
  res.json({ success: true, data: notifications });

};

const getNotificationById = async (req, res) => {
  const { id } = req.params;
  
  const notification = notifications.find((n) => n.id === id);
  
  if (!notification) {
    await Log("backend", "warn", "controller", `Notification not found: ${id}`);
    return res.status(404).json({ success: false, message: "Notification not found" });
  }
  
  await Log("backend", "info", "controller", `Fetched notification: ${id}`);
  
  res.json({ success: true, data: notification });
};

const createNotification = async (req, res) => {
  const { type, message, studentID } = req.body;
  
  if (!type || !message || !studentID) {
    await Log("backend", "error", "controller", "Missing required fields in create notification");
    return res.status(400).json({ success: false, message: "type, message and studentID are required" });
  }
  
  const notification = {
    id: uuidv4(),
    type,
    message,
    studentID,
    isRead: false,
    createdAt: new Date().toISOString()
  };
  
  notifications.push(notification);
  
  await Log("backend", "info", "controller", `Notification created: ${notification.id}`);
  res.status(201).json({ success: true, data: notification });
};

const updateNotification = async (req, res) => {
  const { id } = req.params;
  
  const index = notifications.findIndex((n) => n.id === id);
  
  if (index === -1) {
    await Log("backend", "warn", "controller", `Update failed - not found: ${id}`);
    return res.status(404).json({ success: false, message: "Notification not found" });
  }
  
  notifications[index] = { ...notifications[index], ...req.body };
  
  await Log("backend", "info", "controller", `Notification updated: ${id}`);
  
  res.json({ success: true, data: notifications[index] });
};

const deleteNotification = async (req, res) => {
  const { id } = req.params;
  
  const index = notifications.findIndex((n) => n.id === id);
  
  if (index === -1) {
    await Log("backend", "warn", "controller", `Delete failed - not found: ${id}`);
    return res.status(404).json({ success: false, message: "Notification not found" });
  }
  
  notifications.splice(index, 1);
  
  await Log("backend", "info", "controller", `Notification deleted: ${id}`);
  
  res.json({ success: true, message: "Notification deleted" });
};

const markAsRead = async (req, res) => {
  const { id } = req.params;
  
  const index = notifications.findIndex((n) => n.id === id);
  
  if (index === -1) {
    await Log("backend", "warn", "controller", `Mark read failed - not found: ${id}`);
    return res.status(404).json({ success: false, message: "Notification not found" });
  }
  
  notifications[index].isRead = true;
  
  await Log("backend", "info", "controller", `Notification marked as read: ${id}`);
  
  res.json({ success: true, data: notifications[index] });
};

module.exports = {
  getAllNotifications,
  getNotificationById,
  createNotification,
  updateNotification,
  deleteNotification,
  markAsRead
};