const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS, // Gmail App Password
  },
});

// Send ticket created email to user
exports.sendTicketCreatedEmail = async (toEmail, userName, ticket) => {
  try {
    await transporter.sendMail({
      from: `"IT Help Desk" <${process.env.EMAIL_USER}>`,
      to: toEmail,
      subject: `✅ Ticket Created: ${ticket.ticketId}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden;">
          <div style="background: #1a73e8; padding: 20px; text-align: center;">
            <h2 style="color: white; margin: 0;">IT Help Desk</h2>
          </div>
          <div style="padding: 30px;">
            <p style="font-size: 16px;">Hello <strong>${userName}</strong>,</p>
            <p>Your support ticket has been successfully created. Our team will review it shortly.</p>
            <div style="background: #f5f5f5; border-radius: 6px; padding: 16px; margin: 20px 0;">
              <p><strong>Ticket ID:</strong> ${ticket.ticketId}</p>
              <p><strong>Title:</strong> ${ticket.title}</p>
              <p><strong>Category:</strong> ${ticket.category}</p>
              <p><strong>Priority:</strong> ${ticket.priority}</p>
              <p><strong>Status:</strong> ${ticket.status}</p>
            </div>
            <p style="color: #666; font-size: 13px;">You will be notified when a technician is assigned to your ticket.</p>
          </div>
          <div style="background: #f0f0f0; padding: 12px; text-align: center; font-size: 12px; color: #999;">
            IT Help Desk System &copy; ${new Date().getFullYear()}
          </div>
        </div>
      `,
    });
    console.log(`Ticket created email sent to ${toEmail}`);
  } catch (err) {
    console.error("Email send error:", err.message);
  }
};

// Send assigned email to technician
exports.sendTicketAssignedEmail = async (techEmail, techName, ticket, userName) => {
  try {
    await transporter.sendMail({
      from: `"IT Help Desk" <${process.env.EMAIL_USER}>`,
      to: techEmail,
      subject: `🔧 New Ticket Assigned: ${ticket.ticketId}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden;">
          <div style="background: #f57c00; padding: 20px; text-align: center;">
            <h2 style="color: white; margin: 0;">New Ticket Assigned</h2>
          </div>
          <div style="padding: 30px;">
            <p style="font-size: 16px;">Hello <strong>${techName}</strong>,</p>
            <p>A new ticket has been assigned to you. Please review and take action.</p>
            <div style="background: #fff8e1; border-radius: 6px; padding: 16px; margin: 20px 0; border-left: 4px solid #f57c00;">
              <p><strong>Ticket ID:</strong> ${ticket.ticketId}</p>
              <p><strong>Title:</strong> ${ticket.title}</p>
              <p><strong>Description:</strong> ${ticket.description}</p>
              <p><strong>Priority:</strong> <span style="color: ${ticket.priority === 'Critical' ? 'red' : ticket.priority === 'High' ? 'orange' : 'green'}">${ticket.priority}</span></p>
              <p><strong>Reported By:</strong> ${userName}</p>
            </div>
            <p>Please log in to the Help Desk portal to update the ticket status.</p>
          </div>
          <div style="background: #f0f0f0; padding: 12px; text-align: center; font-size: 12px; color: #999;">
            IT Help Desk System &copy; ${new Date().getFullYear()}
          </div>
        </div>
      `,
    });
    console.log(`Assigned email sent to ${techEmail}`);
  } catch (err) {
    console.error("Email send error:", err.message);
  }
};

// Send status update email to user
exports.sendStatusUpdateEmail = async (toEmail, userName, ticket) => {
  try {
    await transporter.sendMail({
      from: `"IT Help Desk" <${process.env.EMAIL_USER}>`,
      to: toEmail,
      subject: `📌 Ticket Update: ${ticket.ticketId} - ${ticket.status}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden;">
          <div style="background: #388e3c; padding: 20px; text-align: center;">
            <h2 style="color: white; margin: 0;">Ticket Status Updated</h2>
          </div>
          <div style="padding: 30px;">
            <p>Hello <strong>${userName}</strong>,</p>
            <p>Your ticket status has been updated.</p>
            <div style="background: #e8f5e9; border-radius: 6px; padding: 16px; margin: 20px 0; border-left: 4px solid #388e3c;">
              <p><strong>Ticket ID:</strong> ${ticket.ticketId}</p>
              <p><strong>Title:</strong> ${ticket.title}</p>
              <p><strong>New Status:</strong> ${ticket.status}</p>
            </div>
            ${ticket.status === "Resolved" ? "<p>🎉 Your issue has been resolved! Please close the ticket if you're satisfied.</p>" : ""}
          </div>
          <div style="background: #f0f0f0; padding: 12px; text-align: center; font-size: 12px; color: #999;">
            IT Help Desk System &copy; ${new Date().getFullYear()}
          </div>
        </div>
      `,
    });
    console.log(`Status update email sent to ${toEmail}`);
  } catch (err) {
    console.error("Email send error:", err.message);
  }
};
