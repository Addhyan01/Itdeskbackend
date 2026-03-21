const Ticket = require("../models/Ticket");
const User = require("../models/User");
const cloudinary = require("../config/cloudinary");
const streamifier = require("streamifier");
const {
  sendTicketCreatedEmail,
  sendTicketAssignedEmail,
  sendStatusUpdateEmail,
} = require("../services/emailService");

// Helper: upload buffer to cloudinary
const uploadToCloudinary = (buffer) => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: "ticket_attachments" },
      (error, result) => {
        if (error) reject(error);
        else resolve(result);
      }
    );
    streamifier.createReadStream(buffer).pipe(stream);
  });
};

// ─── USER: Create Ticket ────────────────────────────────
exports.createTicket = async (req, res) => {
  try {
    const { title, description, category, priority } = req.body;

    if (!title || !description) {
      return res.status(400).json({ message: "Title and description are required" });
    }

    let attachments = [];

    // Upload files if any
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        const result = await uploadToCloudinary(file.buffer);
        attachments.push({
          url: result.secure_url,
          filename: file.originalname,
        });
      }
    }

    const ticket = await Ticket.create({
      title,
      description,
      category: category || "Other",
      priority: priority || "Medium",
      createdBy: req.user.id,
      attachments,
    });

    // Send email to user
    const user = await User.findById(req.user.id);
    if (user) {
      await sendTicketCreatedEmail(user.email, user.name, ticket);
    }

    res.status(201).json({ message: "Ticket created successfully", ticket });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ─── USER: Get My Tickets ───────────────────────────────
exports.getMyTickets = async (req, res) => {
  try {
    const tickets = await Ticket.find({ createdBy: req.user.id })
      .populate("assignedTo", "name email")
      .sort({ createdAt: -1 });

    res.json(tickets);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ─── USER: Get Single Ticket ────────────────────────────
exports.getTicketById = async (req, res) => {
  try {
    const ticket = await Ticket.findById(req.params.id)
      .populate("createdBy", "name email")
      .populate("assignedTo", "name email")
      .populate("comments.author", "name");

    if (!ticket) {
      return res.status(404).json({ message: "Ticket not found" });
    }

    // Only owner, assigned tech, or admin can view
    const isOwner = ticket.createdBy._id.toString() === req.user.id;
    const isAssigned = ticket.assignedTo && ticket.assignedTo._id.toString() === req.user.id;

    const user = await User.findById(req.user.id);
    if (!isOwner && !isAssigned && user.role !== "admin") {
      return res.status(403).json({ message: "Access denied" });
    }

    res.json(ticket);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ─── ADMIN: Get All Tickets ─────────────────────────────
exports.getAllTickets = async (req, res) => {
  try {
    const { status, priority, category, page = 1, limit = 10 } = req.query;

    const filter = {};
    if (status) filter.status = status;
    if (priority) filter.priority = priority;
    if (category) filter.category = category;

    const total = await Ticket.countDocuments(filter);
    const tickets = await Ticket.find(filter)
      .populate("createdBy", "name email")
      .populate("assignedTo", "name email")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    res.json({ tickets, total, page: Number(page), totalPages: Math.ceil(total / limit) });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ─── ADMIN: Assign Ticket to Technician ─────────────────
exports.assignTicket = async (req, res) => {
  try {
    const { technicianId } = req.body;

    const technician = await User.findById(technicianId);
    if (!technician || technician.role !== "technician") {
      return res.status(400).json({ message: "Invalid technician" });
    }

    const ticket = await Ticket.findByIdAndUpdate(
      req.params.id,
      { assignedTo: technicianId, status: "Assigned" },
      { new: true }
    ).populate("createdBy", "name email");

    if (!ticket) {
      return res.status(404).json({ message: "Ticket not found" });
    }

    // Email to technician
    await sendTicketAssignedEmail(
      technician.email,
      technician.name,
      ticket,
      ticket.createdBy.name
    );

    // Email to user about assignment
    await sendStatusUpdateEmail(ticket.createdBy.email, ticket.createdBy.name, ticket);

    res.json({ message: "Ticket assigned successfully", ticket });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ─── TECHNICIAN: Get Assigned Tickets ───────────────────
exports.getAssignedTickets = async (req, res) => {
  try {
    const tickets = await Ticket.find({ assignedTo: req.user.id })
      .populate("createdBy", "name email")
      .sort({ createdAt: -1 });

    res.json(tickets);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ─── TECHNICIAN: Update Ticket Status ───────────────────
exports.updateTicketStatus = async (req, res) => {
  try {
    const { status, comment } = req.body;

    const validStatuses = ["In Progress", "Resolved", "Closed"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }

    const ticket = await Ticket.findById(req.params.id).populate("createdBy", "name email");

    if (!ticket) {
      return res.status(404).json({ message: "Ticket not found" });
    }

    // Only assigned technician can update
    if (ticket.assignedTo?.toString() !== req.user.id) {
      return res.status(403).json({ message: "Not authorized" });
    }

    ticket.status = status;
    if (status === "Resolved") {
      ticket.resolvedAt = new Date();
    }

    // Add comment if provided
    if (comment) {
      ticket.comments.push({ author: req.user.id, text: comment });
    }

    await ticket.save();

    // Notify user via email
    await sendStatusUpdateEmail(ticket.createdBy.email, ticket.createdBy.name, ticket);

    res.json({ message: "Ticket updated", ticket });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ─── ADMIN: Dashboard Stats ──────────────────────────────
exports.getDashboardStats = async (req, res) => {
  try {
    const total = await Ticket.countDocuments();
    const open = await Ticket.countDocuments({ status: "Open" });
    const assigned = await Ticket.countDocuments({ status: "Assigned" });
    const inProgress = await Ticket.countDocuments({ status: "In Progress" });
    const resolved = await Ticket.countDocuments({ status: "Resolved" });
    const closed = await Ticket.countDocuments({ status: "Closed" });

    // Overdue: Open/Assigned tickets older than 24 hours
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const overdue = await Ticket.countDocuments({
      status: { $in: ["Open", "Assigned"] },
      createdAt: { $lt: oneDayAgo },
    });

    // Recent 5 tickets
    const recentTickets = await Ticket.find()
      .populate("createdBy", "name")
      .populate("assignedTo", "name")
      .sort({ createdAt: -1 })
      .limit(5);

    // All technicians with their active ticket count
    const technicians = await User.find({ role: "technician" }).select("-password");
    const technicianStats = await Promise.all(
      technicians.map(async (tech) => {
        const activeCount = await Ticket.countDocuments({
          assignedTo: tech._id,
          status: { $in: ["Assigned", "In Progress"] },
        });
        return { ...tech.toObject(), activeTickets: activeCount };
      })
    );

    res.json({
      stats: { total, open, assigned, inProgress, resolved, closed, overdue },
      recentTickets,
      technicians: technicianStats,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ─── USER: Add Comment ───────────────────────────────────
exports.addComment = async (req, res) => {
  try {
    const { text } = req.body;
    const ticket = await Ticket.findById(req.params.id);

    if (!ticket) return res.status(404).json({ message: "Ticket not found" });

    ticket.comments.push({ author: req.user.id, text });
    await ticket.save();

    const updated = await Ticket.findById(req.params.id).populate("comments.author", "name role");
    res.json({ message: "Comment added", comments: updated.comments });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
