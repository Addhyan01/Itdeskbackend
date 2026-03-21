const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");
const upload = require("../middleware/upload");
const {
  createTicket, getMyTickets, getTicketById,
  getAllTickets, assignTicket, getAssignedTickets,
  getResolvedTickets, updateTicketStatus, getDashboardStats,
  addComment, reopenTicket, closeTicket, deleteTicket, modifyTicket,
} = require("../controllers/ticketController");

// ── Stats (before /:id to avoid conflict) ────────────────
router.get("/stats", authMiddleware, getDashboardStats);
router.get("/resolved", authMiddleware, roleMiddleware("technician", "admin"), getResolvedTickets);
router.get("/assigned", authMiddleware, roleMiddleware("technician"), getAssignedTickets);
router.get("/my", authMiddleware, getMyTickets);
router.get("/all", authMiddleware, roleMiddleware("admin"), getAllTickets);

// ── Single ticket operations ──────────────────────────────
router.post("/create", authMiddleware, upload.array("attachments", 5), createTicket);
router.get("/:id", authMiddleware, getTicketById);
router.put("/:id/assign", authMiddleware, roleMiddleware("admin"), assignTicket);
router.put("/:id/status", authMiddleware, roleMiddleware("technician"), updateTicketStatus);
router.put("/:id/reopen", authMiddleware, roleMiddleware("admin", "technician"), reopenTicket);
router.put("/:id/close", authMiddleware, closeTicket);
router.put("/:id/modify", authMiddleware, roleMiddleware("admin"), modifyTicket);
router.delete("/:id", authMiddleware, roleMiddleware("admin"), deleteTicket);
router.post("/:id/comment", authMiddleware, addComment);

module.exports = router;
