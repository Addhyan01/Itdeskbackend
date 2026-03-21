require("dotenv").config()
const express = require("express")
const cors = require("cors")
const mongoose = require("mongoose")

const app = express()
app.use(cors())
app.use(express.json())

mongoose.connect(process.env.MONGO_URI)
.then(() => {
  console.log("✅ MongoDB Connected")

  // Routes sirf connection ke BAAD load karo
  const authRoutes = require("./routes/authRoutes");
  const ticketRoutes = require("./routes/ticketRoutes");
  const adminRoutes = require("./routes/adminRoutes");

  app.use("/api/auth", authRoutes);
  app.use("/api/tickets", ticketRoutes);
  app.use("/api/admin", adminRoutes);

  app.get("/", (req, res) => res.json({ message: "✅ HelpDesk API Running" }))

  const PORT = process.env.PORT || 8000
  app.listen(PORT, () => console.log(`🚀 Server running on ${PORT}`))
})
.catch(err => console.log("❌ MongoDB Error:", err))