const Ticket = require("../models/Ticket");
const User = require("../models/User");
const cloudinary = require("../config/cloudinary");
const streamifier = require("streamifier");
const { sendTicketCreatedEmail, sendTicketAssignedEmail, sendStatusUpdateEmail } = require("../services/emailService");
const { createNotification, createMultipleNotifications } = require("../services/notificationService");

// Helper: upload to cloudinary
const uploadToCloudinary = (buffer) => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: "ticket_attachments" },
      (error, result) => { if (error) reject(error); else resolve(result); }
    );
    streamifier.createReadStream(buffer).pipe(stream);
  });
};

// Helper: add audit log
const addAuditLog = (ticket, action, userId, userName, note = "") => {
  ticket.auditLog.push({ action, performedBy: userId, performedByName: userName, note });
};

// ─── CREATE TICKET ────────────────────────────────────────
exports.createTicket = async (req, res) => {
  try {
    const { title, description, category, priority, dueDate, reportedForId } = req.body;
    if (!title || !description) return res.status(400).json({ message: "Title and description required" });

    const creator = await User.findById(req.user.id);

    // reportedFor logic:
    // User → apne liye (reportedFor = createdBy)
    // Admin/Tech → selected user ke liye (reportedForId required)
    let reportedFor = req.user.id; // default: self
    if (creator.role !== "user") {
      if (!reportedForId) return res.status(400).json({ message: "Please select the user this ticket is for" });
      reportedFor = reportedForId;
    }

    const reportedUser = await User.findById(reportedFor);
    if (!reportedUser) return res.status(404).json({ message: "Reported user not found" });

    let attachments = [];
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        const result = await uploadToCloudinary(file.buffer);
        attachments.push({ url: result.secure_url, filename: file.originalname });
      }
    }

    const ticket = new Ticket({
      title, description,
      category: category || "Other",
      priority: priority || "Medium",
      createdBy: req.user.id,
      createdByRole: creator.role,
      reportedFor: reportedFor,
      attachments,
      dueDate: dueDate || null,
      status: "Pending",
    });

    // Audit log - clearly batao kisne kisके liye banaya
    const auditMsg = creator.role === "user"
      ? `Ticket self-created by User: ${creator.name}`
      : `Ticket created by ${creator.role}: ${creator.name} for User: ${reportedUser.name}`;

    addAuditLog(ticket, auditMsg, req.user.id, creator.name);
    await ticket.save();

    // Email to creator
    // await sendTicketCreatedEmail(creator.email, creator.name, ticket);


    sendTicketCreatedEmail(creator.email, creator.name, ticket).catch(err => 
  console.error("Email error:", err)
);
    // If admin/tech created for user → also notify that user
    if (creator.role !== "user") {
      await createNotification({
        recipient: reportedFor,
        title: "Ticket Created For You",
        message: `${creator.role === "admin" ? "Admin" : "Technician"} ${creator.name} created ticket ${ticket.ticketId} for you: ${ticket.title}`,
        type: "ticket_created",
        ticketId: ticket._id,
        ticketRef: ticket.ticketId,
      });
    }

    // Notify admins if user/tech created ticket
    if (creator.role !== "admin") {
      const admins = await User.find({ role: "admin" });
      const notifs = admins.map(admin => ({
        recipient: admin._id,
        title: "New Ticket Created",
        message: `${creator.name} (${creator.role}) created ticket ${ticket.ticketId} for ${reportedUser.name}`,
        type: "ticket_created",
        ticketId: ticket._id,
        ticketRef: ticket.ticketId,
      }));
      await createMultipleNotifications(notifs);
    }

    res.status(201).json({ message: "Ticket created successfully", ticket });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ─── GET MY TICKETS (User - tickets reported for them) ────
exports.getMyTickets = async (req, res) => {
  try {
    const { status, priority, category, search } = req.query;

    // User dekhega wo tickets jisme wo reportedFor hai
    const filter = { reportedFor: req.user.id };
    if (status) filter.status = status;
    if (priority) filter.priority = priority;
    if (category) filter.category = category;
    if (search) filter.$or = [
      { title: { $regex: search, $options: "i" } },
      { ticketId: { $regex: search, $options: "i" } },
    ];

    const tickets = await Ticket.find(filter)
      .populate("createdBy", "name email role")
      .populate("reportedFor", "name email")
      .populate("assignedTo", "name email")
      .sort({ createdAt: -1 });

    const ticketsWithSLA = tickets.map(t => ({
      ...t.toObject(),
      slaStatus: t.getSLAStatus(),
      slaHours: t.getSLAHours(),
    }));

    res.json(ticketsWithSLA);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ─── GET SINGLE TICKET ────────────────────────────────────
exports.getTicketById = async (req, res) => {
  try {
    const ticket = await Ticket.findById(req.params.id)
      .populate("createdBy", "name email role")
      .populate("reportedFor", "name email")
      .populate("assignedTo", "name email")
      .populate("comments.author", "name role")
      .populate("auditLog.performedBy", "name role");

    if (!ticket) return res.status(404).json({ message: "Ticket not found" });

    const user = await User.findById(req.user.id);
    const isReportedFor = ticket.reportedFor?._id?.toString() === req.user.id;
    const isCreator = ticket.createdBy._id.toString() === req.user.id;
    const isAssigned = ticket.assignedTo?._id?.toString() === req.user.id;

    if (!isReportedFor && !isCreator && !isAssigned && user.role !== "admin") {
      return res.status(403).json({ message: "Access denied" });
    }

    res.json({ ...ticket.toObject(), slaStatus: ticket.getSLAStatus(), slaHours: ticket.getSLAHours() });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ─── GET ALL TICKETS (Admin) ──────────────────────────────
exports.getAllTickets = async (req, res) => {
  try {
    const { status, priority, category, search, page = 1, limit = 10 } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (priority) filter.priority = priority;
    if (category) filter.category = category;
    if (search) filter.$or = [
      { title: { $regex: search, $options: "i" } },
      { ticketId: { $regex: search, $options: "i" } },
    ];

    const total = await Ticket.countDocuments(filter);
    const tickets = await Ticket.find(filter)
      .populate("createdBy", "name email role")
      .populate("reportedFor", "name email")
      .populate("assignedTo", "name email")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    const ticketsWithSLA = tickets.map(t => ({
      ...t.toObject(),
      slaStatus: t.getSLAStatus(),
      slaHours: t.getSLAHours(),
    }));

    res.json({ tickets: ticketsWithSLA, total, page: Number(page), totalPages: Math.ceil(total / limit) });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ─── ASSIGN TICKET (Admin) ────────────────────────────────
exports.assignTicket = async (req, res) => {
  try {
    const { technicianId, dueDate } = req.body;
    const admin = await User.findById(req.user.id);

    const technician = await User.findById(technicianId);
    if (!technician || technician.role !== "technician") {
      return res.status(400).json({ message: "Invalid technician" });
    }

    const ticket = await Ticket.findById(req.params.id)
      .populate("createdBy", "name email")
      .populate("reportedFor", "name email");
    if (!ticket) return res.status(404).json({ message: "Ticket not found" });

    ticket.assignedTo = technicianId;
    ticket.status = "In Process";
    if (dueDate) ticket.dueDate = dueDate;

    addAuditLog(ticket, `Assigned to Technician: ${technician.name}`, req.user.id, admin.name, `Due: ${dueDate || "Not set"}`);
    await ticket.save();

    const reportedUser = ticket.reportedFor || ticket.createdBy;

    sendTicketAssignedEmail(technician.email, technician.name, ticket, reportedUser.name).catch(err => console.error('Email error:', err));
    sendStatusUpdateEmail(reportedUser.email, reportedUser.name, ticket).catch(err => console.error('Email error:', err));

    await createMultipleNotifications([
      {
        recipient: technicianId,
        title: "New Ticket Assigned",
        message: `Ticket ${ticket.ticketId} assigned to you. User: ${reportedUser.name}. Issue: ${ticket.title}`,
        type: "ticket_assigned",
        ticketId: ticket._id,
        ticketRef: ticket.ticketId,
      },
      {
        recipient: reportedUser._id,
        title: "Technician Assigned",
        message: `Technician ${technician.name} assigned to your ticket ${ticket.ticketId}`,
        type: "ticket_assigned",
        ticketId: ticket._id,
        ticketRef: ticket.ticketId,
      }
    ]);

    res.json({ message: "Ticket assigned successfully", ticket });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ─── GET ASSIGNED TICKETS (Technician) ───────────────────
exports.getAssignedTickets = async (req, res) => {
  try {
    const { status, search } = req.query;
    const filter = { assignedTo: req.user.id };
    if (status) filter.status = status;
    if (search) filter.$or = [
      { title: { $regex: search, $options: "i" } },
      { ticketId: { $regex: search, $options: "i" } },
    ];

    const tickets = await Ticket.find(filter)
      .populate("createdBy", "name email role")
      .populate("reportedFor", "name email")
      .populate("assignedTo", "name email")
      .sort({ createdAt: -1 });

    const ticketsWithSLA = tickets.map(t => ({
      ...t.toObject(),
      slaStatus: t.getSLAStatus(),
      slaHours: t.getSLAHours(),
    }));

    res.json(ticketsWithSLA);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ─── GET RESOLVED TICKETS (Technician + Admin) ───────────
exports.getResolvedTickets = async (req, res) => {
  try {
    const tickets = await Ticket.find({ status: { $in: ["Resolved", "Closed"] } })
      .populate("createdBy", "name email role")
      .populate("reportedFor", "name email")
      .populate("assignedTo", "name email")
      .sort({ resolvedAt: -1 });

    res.json(tickets);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ─── UPDATE TICKET STATUS (Technician) ───────────────────
exports.updateTicketStatus = async (req, res) => {
  try {
    const { status, comment, dueDate } = req.body;
    const tech = await User.findById(req.user.id);

    const validStatuses = ["Working", "Resolved"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ message: "Technician can only set Working or Resolved" });
    }

    const ticket = await Ticket.findById(req.params.id)
      .populate("createdBy", "name email")
      .populate("reportedFor", "name email");
    if (!ticket) return res.status(404).json({ message: "Ticket not found" });

    if (ticket.assignedTo?.toString() !== req.user.id) {
      return res.status(403).json({ message: "Not authorized - not your ticket" });
    }

    ticket.status = status;
    if (status === "Resolved") ticket.resolvedAt = new Date();
    if (dueDate) ticket.dueDate = dueDate;

    addAuditLog(ticket, `Status changed to ${status}`, req.user.id, tech.name, comment || "");

    if (comment) {
      ticket.comments.push({ author: req.user.id, authorName: tech.name, authorRole: tech.role, text: comment });
    }

    await ticket.save();

    // Notify the user the ticket is for
    const notifyUser = ticket.reportedFor || ticket.createdBy;
    sendStatusUpdateEmail(notifyUser.email, notifyUser.name, ticket).catch(err => console.error('Email error:', err));
    await createNotification({
      recipient: notifyUser._id,
      title: `Ticket ${status}`,
      message: `Your ticket ${ticket.ticketId} status changed to ${status}`,
      type: "status_updated",
      ticketId: ticket._id,
      ticketRef: ticket.ticketId,
    });

    res.json({ message: "Ticket updated", ticket });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ─── REOPEN TICKET ────────────────────────────────────────
exports.reopenTicket = async (req, res) => {
  try {
    const { note } = req.body;
    const user = await User.findById(req.user.id);

    const ticket = await Ticket.findById(req.params.id)
      .populate("createdBy", "name email")
      .populate("reportedFor", "name email");
    if (!ticket) return res.status(404).json({ message: "Ticket not found" });

    if (!["Resolved", "Closed"].includes(ticket.status)) {
      return res.status(400).json({ message: "Only Resolved/Closed tickets can be reopened" });
    }

    ticket.status = "Pending";
    ticket.assignedTo = null;
    ticket.resolvedAt = null;

    addAuditLog(ticket, `Ticket reopened by ${user.role}: ${user.name}`, req.user.id, user.name, note || "");
    await ticket.save();

    const admins = await User.find({ role: "admin" });
    const notifs = admins.map(admin => ({
      recipient: admin._id,
      title: "Ticket Reopened",
      message: `Ticket ${ticket.ticketId} reopened by ${user.name} (${user.role}). Please reassign.`,
      type: "ticket_reopened",
      ticketId: ticket._id,
      ticketRef: ticket.ticketId,
    }));
    await createMultipleNotifications(notifs);

    res.json({ message: "Ticket reopened. Admin will reassign.", ticket });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ─── CLOSE TICKET ─────────────────────────────────────────
exports.closeTicket = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) return res.status(404).json({ message: "Ticket not found" });

    // User can only close tickets reported for them
    if (user.role === "user" && ticket.reportedFor?.toString() !== req.user.id) {
      return res.status(403).json({ message: "You can only close your own tickets" });
    }

    ticket.status = "Closed";
    ticket.closedAt = new Date();
    addAuditLog(ticket, `Ticket closed by ${user.role}: ${user.name}`, req.user.id, user.name);
    await ticket.save();

    res.json({ message: "Ticket closed", ticket });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ─── DELETE TICKET (Admin) ────────────────────────────────
exports.deleteTicket = async (req, res) => {
  try {
    const ticket = await Ticket.findByIdAndDelete(req.params.id);
    if (!ticket) return res.status(404).json({ message: "Ticket not found" });
    res.json({ message: "Ticket deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ─── MODIFY TICKET (Admin) ────────────────────────────────
exports.modifyTicket = async (req, res) => {
  try {
    const { title, description, category, priority, dueDate } = req.body;
    const admin = await User.findById(req.user.id);

    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) return res.status(404).json({ message: "Ticket not found" });

    const changes = [];
    if (title && title !== ticket.title) { ticket.title = title; changes.push("title"); }
    if (description && description !== ticket.description) { ticket.description = description; changes.push("description"); }
    if (category && category !== ticket.category) { ticket.category = category; changes.push("category"); }
    if (priority && priority !== ticket.priority) { ticket.priority = priority; changes.push("priority"); }
    if (dueDate) { ticket.dueDate = dueDate; changes.push("dueDate"); }

    addAuditLog(ticket, `Modified: ${changes.join(", ")}`, req.user.id, admin.name);
    await ticket.save();

    res.json({ message: "Ticket updated", ticket });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ─── ADD COMMENT ──────────────────────────────────────────
exports.addComment = async (req, res) => {
  try {
    const { text } = req.body;
    if (!text) return res.status(400).json({ message: "Comment text required" });

    const user = await User.findById(req.user.id);
    const ticket = await Ticket.findById(req.params.id)
      .populate("reportedFor", "name email")
      .populate("createdBy", "name email");
    if (!ticket) return res.status(404).json({ message: "Ticket not found" });

    // User can only comment on their own tickets
    if (user.role === "user" && ticket.reportedFor?._id?.toString() !== req.user.id) {
      return res.status(403).json({ message: "Access denied" });
    }

    ticket.comments.push({ author: req.user.id, authorName: user.name, authorRole: user.role, text });
    addAuditLog(ticket, `Comment by ${user.role}: ${user.name}`, req.user.id, user.name);
    await ticket.save();

    const notifyUser = ticket.reportedFor || ticket.createdBy;
    if (notifyUser._id.toString() !== req.user.id) {
      await createNotification({
        recipient: notifyUser._id,
        title: "New Comment",
        message: `${user.name} (${user.role}) commented on ticket ${ticket.ticketId}`,
        type: "comment_added",
        ticketId: ticket._id,
        ticketRef: ticket.ticketId,
      });
    }

    const updated = await Ticket.findById(req.params.id).populate("comments.author", "name role");
    res.json({ message: "Comment added", comments: updated.comments });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ─── DASHBOARD STATS ──────────────────────────────────────
exports.getDashboardStats = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    let stats = {};
    let recentTickets = [];

    if (user.role === "admin") {
      const [total, pending, inProcess, working, resolved, closed] = await Promise.all([
        Ticket.countDocuments(),
        Ticket.countDocuments({ status: "Pending" }),
        Ticket.countDocuments({ status: "In Process" }),
        Ticket.countDocuments({ status: "Working" }),
        Ticket.countDocuments({ status: "Resolved" }),
        Ticket.countDocuments({ status: "Closed" }),
      ]);

      const overdue = await Ticket.countDocuments({
        status: { $in: ["Pending", "In Process", "Working"] },
        dueDate: { $lt: new Date(), $ne: null },
      });

      recentTickets = await Ticket.find()
        .populate("createdBy", "name role")
        .populate("reportedFor", "name email")
        .populate("assignedTo", "name")
        .sort({ createdAt: -1 })
        .limit(5);

      const technicians = await User.find({ role: "technician" }).select("-password");
      const techStats = await Promise.all(technicians.map(async (tech) => {
        const active = await Ticket.countDocuments({ assignedTo: tech._id, status: { $in: ["In Process", "Working"] } });
        const resolved = await Ticket.countDocuments({ assignedTo: tech._id, status: "Resolved" });
        return { ...tech.toObject(), activeTickets: active, resolvedTickets: resolved };
      }));

      stats = { total, pending, inProcess, working, resolved, closed, overdue, technicians: techStats };

    } else if (user.role === "technician") {
      const [assigned, working, resolved] = await Promise.all([
        Ticket.countDocuments({ assignedTo: req.user.id, status: "In Process" }),
        Ticket.countDocuments({ assignedTo: req.user.id, status: "Working" }),
        Ticket.countDocuments({ assignedTo: req.user.id, status: "Resolved" }),
      ]);

      recentTickets = await Ticket.find({ assignedTo: req.user.id })
        .populate("createdBy", "name role")
        .populate("reportedFor", "name email")
        .sort({ createdAt: -1 })
        .limit(5);

      stats = { assigned, working, resolved, total: assigned + working + resolved };
    }

    const ticketsWithSLA = recentTickets.map(t => ({
      ...t.toObject(),
      slaStatus: t.getSLAStatus(),
    }));

    res.json({ stats, recentTickets: ticketsWithSLA });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};