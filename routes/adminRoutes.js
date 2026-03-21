const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");
const User = require("../models/User");

// Get all users (admin only)
router.get("/users", authMiddleware, roleMiddleware("admin"), async (req, res) => {
  try {
    const users = await User.find().select("-password -__v").sort({ createdAt: -1 });
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get all technicians (admin only)
router.get("/technicians", authMiddleware, roleMiddleware("admin"), async (req, res) => {
  try {
    const technicians = await User.find({ role: "technician" }).select("-password -__v");
    res.json(technicians);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Toggle user active status
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
