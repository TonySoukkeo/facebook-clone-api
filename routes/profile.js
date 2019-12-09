const express = require("express");
const router = express.Router();

// Controllers
const profileControllers = require("../controllers/profile");

router.get("/timeline/:userId", profileControllers.getUserTimeline);

router.get("/details", profileControllers.getProfileDetails);
router.patch("/details", profileControllers.postUpdateProfileDetails);

router.patch("/image", profileControllers.changeImage);
module.exports = router;
