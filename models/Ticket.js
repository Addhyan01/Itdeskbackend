const mongoose = require("mongoose");

const auditLogSchema = new mongoose.Schema({
  action: { type: String, required: true },
  performedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  performedByName: { type: String },
  note: { type: String, default: "" },
  createdAt: { type: Date, default: Date.now }
});

const commentSchema = new mongoose.Schema({
  author: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  authorName: { type: String },
  authorRole: { type: String },
  text: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

const ticketSchema = new mongoose.Schema(
  {
    ticketId: { type: String, unique: true },
    title: { type: String, required: true },
    description: { type: String, required: true },
    category: {
      type: String,
      enum: ["Hardware", "Software", "Network", "Account", "Other"],
      default: "Other",
    },
    priority: {
      type: String,
      enum: ["Low", "Medium", "High", "Critical"],
      default: "Medium",
    },
    status: {
      type: String,
      enum: ["Pending", "In Process", "Working", "Resolved", "Closed"],
      default: "Pending",
    },

    // Jo ticket create kar raha hai (admin/tech/user)
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

    // Jis user ke liye ticket bana hai
    // User khud banaye → reportedFor = createdBy (same)
    // Admin/Tech banaye → reportedFor = selected user
    reportedFor: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },

    // Kis role ne create kiya - for display
    createdByRole: { type: String, enum: ["user", "admin", "technician"], default: "user" },

    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    dueDate: { type: Date, default: null },
    resolvedAt: { type: Date, default: null },
    closedAt: { type: Date, default: null },
    attachments: [{ url: String, filename: String }],
    comments: [commentSchema],
    auditLog: [auditLogSchema],
  },
  { timestamps: true }
);

// Auto-generate ticketId
ticketSchema.pre("save", async function (next) {
  if (!this.ticketId) {
    const count = await mongoose.model("Ticket").countDocuments();
    this.ticketId = `TKT-${String(count + 1).padStart(5, "0")}`;
  }
  next();
});

// SLA hours based on priority
ticketSchema.methods.getSLAHours = function () {
  const sla = { Critical: 4, High: 24, Medium: 48, Low: 72 };
  return sla[this.priority] || 48;
};

// SLA status
ticketSchema.methods.getSLAStatus = function () {
  if (["Resolved", "Closed"].includes(this.status)) return "completed";
  const slaHours = this.getSLAHours();
  const hoursElapsed = (Date.now() - this.createdAt) / (1000 * 60 * 60);
  const percentage = (hoursElapsed / slaHours) * 100;
  if (percentage < 50) return "green";
  if (percentage < 80) return "yellow";
  return "red";
};

module.exports = mongoose.model("Ticket", ticketSchema);
