const express = require("express");
const upload = require("../middleware/upload");


const { signup, login, profile, updateProfile, uploadProfileImage } = require("../controllers/authController");
const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();

router.post("/signup", signup);
router.post("/login",  login);
router.get("/profile", authMiddleware, profile);
router.put("/update-profile", authMiddleware, upload.single("profilePicture"), updateProfile);
router.put(
  "/upload-profile-image",
  authMiddleware,
  upload.single("image"),
  uploadProfileImage
);

module.exports = router;