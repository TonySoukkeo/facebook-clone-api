const jwt = require("jsonwebtoken");
const dotenv = require("dotenv");

dotenv.config();

const isAuth = (req, res, next) => {
  // Get headers
  const headers = req.get("Authorization");

  // Check if headers is empty
  if (!headers) {
    req.isAuth = false;
    return next();
  }

  // If there are headers, extract the token out from it
  const token = headers.split(" ")[1];

  let authorizedToken;

  // Verify token
  try {
    authorizedToken = jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    req.isAuth = false;
    return next();
  }

  // Check if authorized token
  if (!authorizedToken) {
    req.isAuth = false;
    return next();
  }

  // Continue if there are no errors
  req.isAuth = true;

  // Set user id
  req.userId = authorizedToken.userId;

  next();
};

module.exports = isAuth;
