const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");
const User = require("../models/User");
const Ticket = require("../models/Ticket");
const bcrypt = require("bcryptjs");

// ── Admin create user/technician ──────────────────────────
router.post("/create-user", authMiddleware, roleMiddleware("admin"), async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    if (!["user", "technician"].includes(role)) {
      return res.status(400).json({ message: "Role must be user or technician" });
    }
    const exists = await User.findOne({ email });
    if (exists) return res.status(400).json({ message: "Email already exists" });
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({ name, email, password: hashedPassword, role });
    res.json({ message: `${role} created successfully`, user: { ...user.toObject(), password: undefined } });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ── Get all users WITH their tickets ─────────────────────
router.get("/users-with-tickets", authMiddleware, roleMiddleware("admin"), async (req, res) => {
  try {
    const users = await User.find({ role: "user" }).select("-password -__v").sort({ createdAt: -1 });
    const usersWithTickets = await Promise.all(users.map(async (user) => {
      const tickets = await Ticket.find({ reportedFor: user._id })
        .populate("createdBy", "name role")
        .sort({ createdAt: -1 });
      return { ...user.toObject(), tickets };
    }));
    res.json(usersWithTickets);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ── Get all technicians WITH their tickets stats ──────────
router.get("/technicians-with-stats", authMiddleware, roleMiddleware("admin"), async (req, res) => {
  try {
    const technicians = await User.find({ role: "technician" }).select("-password -__v");
    const techWithStats = await Promise.all(technicians.map(async (tech) => {
      const tickets = await Ticket.find({ assignedTo: tech._id })
        .populate("reportedFor", "name email")
        .sort({ createdAt: -1 });
      const activeTickets = tickets.filter(t => ["In Process", "Working"].includes(t.status)).length;
      const resolvedTickets = tickets.filter(t => ["Resolved", "Closed"].includes(t.status)).length;
      return { ...tech.toObject(), tickets, activeTickets, resolvedTickets, totalTickets: tickets.length };
    }));
    res.json(techWithStats);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ── Get all users (simple list) ───────────────────────────
// router.get("/users", authMiddleware, roleMiddleware("admin"), async (req, res) => {
  router.get("/users", authMiddleware, roleMiddleware("admin", "technician"), async (req, res) => {

  try {
    const users = await User.find({ role: "user" }).select("-password -__v").sort({ createdAt: -1 });
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ── Get all technicians (simple list) ─────────────────────
router.get("/technicians", authMiddleware, roleMiddleware("admin"), async (req, res) => {
  try {
    const technicians = await User.find({ role: "technician" }).select("-password -__v");
    res.json(technicians);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ── Toggle user active ────────────────────────────────────
router.put("/users/:id/toggle", authMiddleware, roleMiddleware("admin"), async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: "User not found" });
    user.isActive = !user.isActive;
    await user.save();
    res.json({ message: `User ${user.isActive ? "activated" : "deactivated"}`, user });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;