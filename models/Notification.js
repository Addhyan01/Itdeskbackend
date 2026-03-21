const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema(
  {
    recipient: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    title: { type: String, required: true },
    message: { type: String, required: true },
    type: {
      type: String,
      enum: ["ticket_created", "ticket_assigned", "status_updated", "comment_added", "ticket_reopened", "ticket_closed"],
      required: true,
    },
    ticketId: { type: mongoose.Schema.Types.ObjectId, ref: "Ticket", default: null },
    ticketRef: { type: String, default: "" }, // TKT-00001
    isRead: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Notification", notificationSchema);
