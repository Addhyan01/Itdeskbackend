const User = require("../models/User");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const cloudinary = require("../config/cloudinary");
const streamifier = require("streamifier");



exports.signup = async (req, res, next) => {

  try {
    const { name, email, password, role } = req.body;
    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ message: "User already exists" });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({
      name,
      email,
      password: hashedPassword,
      role,
    });
    res.json({
      message: "User registered successfully"
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.profile = async (req, res) => {

  try{

    const user = await User.findById(req.user.id)
      .select("-password -__v");

    if(!user){
      return res.status(404).json({
        message: "User not found"
      });
    }

    res.json(user);

  }
  catch (error) {
    res.status(500).json({ message: error.message });
  }

};



exports.updateProfile = async (req, res) => {
  try {

    const { name, currentPassword, newPassword,  } = req.body;

    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({
        message: "User not found"
      });
    }

    // name update
    if (name) {
      user.name = name;
    }
    

    if (req.file) {

  const uploadFromBuffer = (buffer) => {
    return new Promise((resolve, reject) => {

      const uploadStream = cloudinary.uploader.upload_stream(
        { folder: "profile_images" },
        (error, result) => {
          if (error) {
            reject(error);
          } else {
            resolve(result);
          }
        }
      );

      streamifier.createReadStream(buffer).pipe(uploadStream);

    });
  };

  const result = await uploadFromBuffer(req.file.buffer);

  user.profilePicture = result.secure_url;
}


    // password change
    if (newPassword) {

      if (!currentPassword) {
        return res.status(400).json({
          message: "Current password required"
        });
      }

      const isMatch = await bcrypt.compare(
        currentPassword,
        user.password
      );

      if (!isMatch) {
        return res.status(400).json({
          message: "Current password incorrect"
        });
      }

      const hashedPassword = await bcrypt.hash(newPassword, 10);

      user.password = hashedPassword;
    }

    await user.save();

    const userData = user.toObject();
    delete userData.password;

    res.json({
      message: "Profile updated successfully",
      user: userData
    });

  } catch (error) {

    res.status(500).json({
      message: error.message
    });

  }
};

exports.login = async (req, res) => {

  try {
        const { email, password } = req.body;


    const user = await User.findOne({ email }).select("-__v");

if (!user) {
  return res.status(400).json({ message: "User not found" });
}

const isMatch = await bcrypt.compare(password, user.password);

if (!isMatch) {
  return res.status(400).json({ message: "Invalid password" });
}

const token = jwt.sign(
  { id: user._id },
  process.env.JWT_SECRET,
  { expiresIn: "1d" }
);

// password remove before sending response
const { password: pwd, ...userData } = user._doc;

res.json({
  token,
  user: userData
});

  } catch (error) {
    res.status(500).json({ message: error.message });
  }

};

exports.uploadProfileImage = async (req, res) => {
  try {

    if (!req.file) {
      return res.status(400).json({
        message: "No file uploaded"
      });
    }

    const result = await new Promise((resolve, reject) => {
      cloudinary.uploader.upload_stream(
        { folder: "profile_images" },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      ).end(req.file.buffer);
    });

    const user = await User.findByIdAndUpdate(
      req.user.id,
      { profilePicture: result.secure_url }, // fix here
      { new: true }
    ).select("-password -__v");

    res.json({
      message: "Profile image uploaded",
      user
    });

  } catch (error) {
    res.status(500).json({
      message: error.message
    });
  }
};
