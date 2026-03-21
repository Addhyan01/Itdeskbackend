const Notification = require("../models/Notification");

exports.createNotification = async ({ recipient, title, message, type, ticketId, ticketRef }) => {
  try {
    await Notification.create({ recipient, title, message, type, ticketId, ticketRef });
  } catch (err) {
    console.error("Notification error:", err.message);
  }
};

exports.createMultipleNotifications = async (notifications) => {
  try {
    await Notification.insertMany(notifications);
  } catch (err) {
    console.error("Notification error:", err.message);
  }
};
