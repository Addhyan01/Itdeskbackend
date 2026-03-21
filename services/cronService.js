const cron = require("node-cron");
const Ticket = require("../models/Ticket");
const { createNotification } = require("./notificationService");

// Run every hour - check resolved tickets older than 24hrs → auto close
const startCronJobs = () => {

  cron.schedule("0 * * * *", async () => {
    try {
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

      const ticketsToClose = await Ticket.find({
        status: "Resolved",
        resolvedAt: { $lt: twentyFourHoursAgo },
      }).populate("createdBy", "name email");

      for (const ticket of ticketsToClose) {
        ticket.status = "Closed";
        ticket.closedAt = new Date();
        ticket.auditLog.push({
          action: "Auto-closed after 24 hours of resolution",
          performedByName: "System",
          note: "Automatically closed by system",
        });
        await ticket.save();

        // Notify user
        if (ticket.createdBy) {
          await createNotification({
            recipient: ticket.createdBy._id,
            title: "Ticket Auto-Closed",
            message: `Your ticket ${ticket.ticketId} has been automatically closed after 24 hours`,
            type: "ticket_closed",
            ticketId: ticket._id,
            ticketRef: ticket.ticketId,
          });
        }

        console.log(`✅ Auto-closed ticket: ${ticket.ticketId}`);
      }

      if (ticketsToClose.length > 0) {
        console.log(`🕐 Auto-closed ${ticketsToClose.length} tickets`);
      }

    } catch (err) {
      console.error("Cron job error:", err.message);
    }
  });

  console.log("⏰ Cron jobs started - Auto-close runs every hour");
};

module.exports = { startCronJobs };
