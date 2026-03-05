const express = require("express")
const router = express.Router()

const upload = require("../middleware/uploadMiddleware")

const {
createTicket,
getTickets
} = require("../controllers/ticketController")

router.post(
"/create",
upload.single("screenshot"),
createTicket
)

router.get("/", getTickets)

module.exports = router