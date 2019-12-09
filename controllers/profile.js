const bcrypt = require("bcryptjs");

// Models
const User = require("../models/user");

// Helper functions
const { getUser } = require("../util/user"),
  error = require("../util/error-handling/error-handler"),
  { removeImage } = require("../util/images/image");

/********************************
 *   Get Current User Timeline   *
 ********************************/
module.exports.getUserTimeline = async (req, res, next) => {
  const userId = req.params.userId;

  try {
    const user = await User.findById(userId, { password: 0 })
      .populate("friends posts")
      .populate({
        path: "posts",
        populate: [
          {
            path: "creator",
            select: "firstName lastName fullName profileImage"
          },
          {
            path: "likes",
            select: "firstName lastName fullName profileImage"
          }
        ]
      });
    // Check if user is undefined
    if (!user) error.errorHandler(404, "User not found");

    // Continue if there are no errors

    // Send current user object back to client
    res.status(200).json({ ...user._doc, name: user.fullName });
  } catch (err) {
    error.error(err, next);
  }
};

/**************************
 *   Get profile details  *
 **************************/
module.exports.getProfileDetails = async (req, res, next) => {
  req.userId = "5dc44cfcc6bf2c3e3f1cab72";

  try {
    // Get and validate user
    const user = await User.findById(req.userId).populate("friends requests");

    if (!user) error.errorHandler(404, "No user found");

    // Send response back to client
    res
      .status(200)
      .json({ message: "User details successfully fetched", user });
  } catch (err) {
    error.error(err);
  }
};

/*****************************
 *   Update profile details  *
 *****************************/
module.exports.postUpdateProfileDetails = async (req, res, next) => {
  const userId = req.userId;

  const firstName = req.body.firstName,
    lastName = req.body.lastName,
    password = req.body.password,
    occupation = req.body.work,
    email = req.body.email;

  try {
    // Check if user is authenticated
    if (!req.isAuth) error.errorHandler(403, "Not Authorized");

    // Get and validate user
    const user = await getUser(userId);

    // Continue if there are no errors

    user.firstName = firstName;

    user.lastName = lastName;

    user.details.occupation = occupation;

    user.details.email = email;

    if (password) {
      // Encrypt new password
      const hashedPw = await bcrypt.hash(password, 12);

      user.password = hashedPw;
    }

    // Save user updates back to database
    await user.save();

    // Return response back to client
    res
      .status(200)
      .json({ message: "Profile udpated", updated: user.details, status: 200 });
  } catch (err) {
    error.error(err, next);
  }
};

/*********************************
 *   Change Profile image/banner *
 *********************************/
module.exports.changeImage = async (req, res, next) => {
  const type = req.body.type,
    userId = req.userId;

  const filename = req.file.filename,
    fileId = req.file.id;

  try {
    // Check if user is authenticated
    if (!req.isAuth) error.errorHandler(403, "Not authorized");

    const user = await User.findById(userId, { password: 0 })
      .populate("friends posts")
      .populate({
        path: "posts",
        populate: {
          path: "creator",
          select: "firstName lastName fullName profileImage"
        }
      });
    // Check if user is undefined
    if (!user) error.errorHandler(404, "No user found");

    // Get old image url and imageId
    let imageUrl, imageId;

    if (type === "profile") {
      imageUrl = user.profileImage.imageUrl;
      imageId = user.profileImage.imageId;
    } else if (type === "banner") {
      imageUrl = user.bannerImage.imageUrl;
      imageId = user.bannerImage.imageId;
    }

    switch (type) {
      case "profile":
        user.profileImage.imageUrl = `http://localhost:8080/${filename}`;
        user.profileImage.imageId = fileId;
        await removeImage(imageUrl, imageId);
        break;

      case "banner":
        user.bannerImage.imageUrl = `http://localhost:8080/${filename}`;
        user.bannerImage.imageId = fileId;
        await removeImage(imageUrl, imageId);
        break;

      default:
        return;
    }

    // Save user changes back to database
    await user.save();
    res.status(200).json({ message: "Image updated", user });
  } catch (err) {
    error.error(err, next);
  }
};
