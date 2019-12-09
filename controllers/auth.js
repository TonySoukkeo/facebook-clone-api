const dotenv = require("dotenv");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const { validationResult } = require("express-validator/check");
const crypto = require("crypto");
const nodemailer = require("nodemailer");
const sgTransport = require("nodemailer-sendgrid-transport");

dotenv.config();

const options = {
  auth: {
    api_user: process.env.SENDGRID_USER,
    api_key: process.env.SENDGRID_KEY
  }
};

const client = nodemailer.createTransport(sgTransport(options));

// Models
const User = require("../models/user");

// Helper functions
const error = require("../util/error-handling/error-handler");

const { userExist } = require("../util/user");

/*******************
 *   User Signup   *
 *******************/
module.exports.postSignup = async (req, res, next) => {
  const email = req.body.email,
    firstName = req.body.firstName,
    lastName = req.body.lastName,
    dob = req.body.dob,
    password = req.body.password,
    gender = req.body.gender;

  try {
    // Check for validation errors
    const validatorErrors = validationResult(req);
    error.validationError(validatorErrors);

    // Check if a user with that email already exists
    const emailExist = await userExist("email", email);

    if (emailExist) error.errorHandler(422, "Email already exists", "email");

    // Continue if there are no errors

    const hashedPw = await bcrypt.hash(password, 12);

    // Create new user object
    const user = new User({
      firstName,
      lastName,
      details: { email, gender },
      dateOfBirth: dob,
      password: hashedPw
    });

    // Save user against database
    const createdUser = await user.save();

    // Send response back to client
    res.status(201).json({ message: "User Created", createdUser });
  } catch (err) {
    error.error(err, next);
  }
};

/*******************
 *    User Login   *
 *******************/
module.exports.postLogin = async (req, res, next) => {
  const email = req.body.email,
    password = req.body.password;

  try {
    // Check for validation errors
    const validatorErrors = validationResult(req);
    error.validationError(validatorErrors);

    // Check if User exists
    const user = await userExist("email", email);

    if (!user) error.errorHandler(401, "Invalid email or password");

    // Compare if password match
    const pwMatch = await bcrypt.compare(password, user.password);

    if (!pwMatch) error.errorHandler(401, "Invalid email or password");

    // Continue if there are no errors

    // Create jsonwebtoken
    const token = jwt.sign(
      { userId: user._id.toString(), email: user.email },
      process.env.JWT_SECRET
    );

    // Send response to client
    res.status(200).json({ token, userId: user._id.toString() });
  } catch (err) {
    error.error(err, next);
  }
};

/***************************
 *    Get Password Reset   *
 ***************************/
module.exports.postPasswordReset = async (req, res, next) => {
  const email = req.body.email;
  // Check if user exist with that email

  try {
    const user = await User.findOne(
      { "details.email": email },
      "details resetToken resetExpiration"
    );

    // Check for validation errors
    const validatorErrors = validationResult(req);

    error.validationError(validatorErrors, "email");

    // Check if user is undefined
    if (!user) error.errorHandler(404, "No user found with that email");

    // Continue if there are no errors

    // Generate random reset token
    const resetToken = await crypto.randomBytes(32).toString("hex");

    // Calculate passwordExpiration
    const resetExpiration = Date.now() + 3600000;

    // Update found user object
    user.resetToken = resetToken;
    user.resetExpiration = resetExpiration;

    // Send password reset email to user
    client.sendMail({
      to: email,
      from: "tony@facebookclone.com",
      subject: "Password reset",
      html: `
        <h3>You have requested a password reset</h3>
        <p>Follow this <a href="${process.env.API_URI}/password-reset/${resetToken}">link</a> here to reset your password</p>
        <p>Password reset link is only valid for an hour</p>
      `
    });

    // Save user updates back to database
    await user.save();

    // Send response back to client
    res
      .status(200)
      .json({ message: "A password reset link has been sent to your email" });
  } catch (err) {
    error.error(err, next);
  }
};

/***************************
 *   Get Password change   *
 ***************************/
module.exports.getPasswordChange = async (req, res, next) => {
  const token = req.params.resetToken;

  try {
    // Check for matching token on a user
    const user = await User.findOne(
      { resetToken: token },
      "resetToken resetExpiration"
    );

    // Check if user is undefined
    if (!user) error.errorHandler(401, "Invalid Token");

    // Check if token has expired
    if (user.resetExpiration < Date.now()) {
      // Clear user reset token and expiration
      user.resetToken = undefined;
      user.resetExpiration = undefined;

      // Save user back to database
      await user.save();
      error.errorHandler(401, "Password reset session has expired");
    }

    // Send status to client
    res.status(200).json({ status: 200 });
  } catch (err) {
    error.error(err, next);
  }
};

/***************************
 *  Post Password change   *
 ***************************/
module.exports.postPasswordChange = async (req, res, next) => {
  const password = req.body.password,
    resetToken = req.body.resetToken;

  try {
    // Get user
    const user = await User.findOne({ resetToken }, "password resetToken");

    // Check if user is undefined
    if (!user) error.errorHandler(404, "No user found");

    // Continue if there are no errors

    // Hash password
    const hashedPw = await bcrypt.hash(password, 12);

    // Assign new password to user
    user.password = hashedPw;

    // Remove resetToken/Expiration
    user.resetToken = undefined;
    user.tokenExpiration = undefined;

    // Save user changes back to database
    await user.save();

    // Send response back to client
    res
      .status(201)
      .json({ message: "Password succesfully changed", status: 201 });
  } catch (err) {
    error.error(err, next);
  }
};
