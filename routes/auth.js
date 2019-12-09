const express = require("express");
const router = express.Router();
const { body } = require("express-validator/check");

// Controllers
const authControllers = require("../controllers/auth");

router.post(
  "/signup",
  [
    body("email", "Email is invalid")
      .isEmail()
      .not()
      .isEmpty(),
    body("firstName", "First name cannot be empty")
      .not()
      .isEmpty(),
    body("lastName", "Last name cannot be empty")
      .not()
      .isEmpty(),
    body("password", "Password must be at least 10 characters long")
      .isLength({ min: 10 })
      .not()
      .isEmpty(),
    body("gender", "Please select a gender")
      .not()
      .isEmpty(),
    body("dob")
      .not()
      .isEmpty()
      .withMessage("Please enter a valid date of birth")
      .custom((value, { req }) => {
        const dob = new Date(value);

        const dateDiff = new Date(Date.now() - dob.getTime());

        const age = Math.abs(dateDiff.getUTCFullYear() - 1970);

        if (age < 18) {
          return Promise.reject(
            "You must be at least 18 years or older to sign up"
          );
        }

        return true;
      })
  ],
  authControllers.postSignup
);

router.post(
  "/login",
  [
    body("email", "Email is invalid")
      .isEmail()
      .not()
      .isEmpty(),
    body("password", "Password must be at least 10 characters long")
      .isLength({ min: 10 })
      .not()
      .isEmpty()
  ],
  authControllers.postLogin
);

router.post(
  "/password-reset",
  [
    body("email", "Please enter a valid email")
      .isEmail()
      .not()
      .isEmpty()
  ],
  authControllers.postPasswordReset
);

router.get("/password-reset/:resetToken", authControllers.getPasswordChange);
router.patch("/password-reset", authControllers.postPasswordChange);

module.exports = router;
