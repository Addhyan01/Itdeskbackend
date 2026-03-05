const express = require("express");
const router = express.Router();
const analyzeIssue = require("../services/geminiService");

router.post("/analyze", async (req, res) => {
  try {
    const { description } = req.body;

    if (!description) {
      return res.status(400).json({ error: "Description is required" });
    }

    // result is now a JSON object from our service
    const result = await analyzeIssue(description);

    res.json({
      success: true,
      analysis: result // This will now be { category, priority, solution }
    });

  } catch (err) {
    console.error("Route Error:", err);
    res.status(500).json({
      success: false,
      error: "AI analysis failed",
      message: err.message
    });
  }
});

module.exports = router;