const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");
const upload = require("../middleware/upload");
const {
  createTicket,
  getMyTickets,
  getTicketById,
  getAllTickets,
  assignTicket,
  getAssignedTickets,
  updateTicketStatus,
  getDashboardStats,
  addComment,
} = require("../controllers/ticketController");

// ── User Routes ──────────────────────────
router.post("/create", authMiddleware, upload.array("attachments", 5), createTicket);
router.get("/my", authMiddleware, getMyTickets);
router.get("/:id", authMiddleware, getTicketById);
router.post("/:id/comment", authMiddleware, addComment);

// ── Admin Routes ─────────────────────────
router.get("/", authMiddleware, roleMiddleware("admin"), getAllTickets);
router.put("/:id/assign", authMiddleware, roleMiddleware("admin"), assignTicket);
router.get("/admin/stats", authMiddleware, roleMiddleware("admin"), getDashboardStats);

// ── Technician Routes ─────────────────────
router.get("/technician/assigned", authMiddleware, roleMiddleware("technician"), getAssignedTickets);
router.put("/:id/status", authMiddleware, roleMiddleware("technician", "admin"), updateTicketStatus);

module.exports = router;
