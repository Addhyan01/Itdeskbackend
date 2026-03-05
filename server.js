require("dotenv").config()

const express = require("express")
const cors = require("cors")
const mongoose = require("mongoose")

const ticketRoutes = require("./routes/ticketRoutes")

const app = express()

app.use(cors())
app.use(express.json())
app.use("/uploads", express.static("uploads"))
const aiRoutes = require("./routes/aiRoutes")

mongoose.connect(process.env.MONGO_URI)
.then(()=>console.log("MongoDB Connected"))
.catch(err=>console.log(err))

app.use("/api/tickets",ticketRoutes)
app.use("/api/ai", aiRoutes)

// app.use("/api/ai",aiRoutes)

app.get("/",(req,res)=>{
res.send("Helpdesk API running")
})

const PORT = process.env.PORT || 5000

app.listen(PORT,()=>{
console.log(`Server running on ${PORT}`)
})