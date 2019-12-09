const express = require("express");
const router = express.Router();
const { body } = require("express-validator/check");

// Controllers
const userControllers = require("../controllers/user");

router.get("/profile/:userId", userControllers.getUsersProfile);

router.get("/friends/:userId", userControllers.getUserFriends);

router.get("/posts", userControllers.getPosts);

router.delete("/post", userControllers.postDeletePost);
router.post("/post", userControllers.postCreatePost);
router.patch("/post", userControllers.postUpdatePost);

router.post("/send-friend", userControllers.sendRequest);

router.get("/friend-request", userControllers.getFriendRequests);
router.delete("/friend-request", userControllers.clearFriendRequestCount);

router.post("/accept-friend", userControllers.acceptRequest);
router.post("/decline-friend", userControllers.declineRequest);
router.post("/cancel-friend", userControllers.cancelFriendRequest);
router.delete("/remove-friend", userControllers.removeFriend);

router.post(
  "/message",
  [
    body("message", "Message can't be empty")
      .not()
      .isEmpty()
  ],
  userControllers.postSendMessage
);
router.delete("/message", userControllers.clearMessageCount);

router.post("/message/friend", userControllers.postAddFriendToMessage);
router.delete("/message/friend", userControllers.postRemoveFriendFromMessage);

router.get("/chat/:userId", userControllers.getMessages);
router.delete("/chat/", userControllers.clearFriendRequestCount);

router.post(
  "/chat/:id",
  [
    body("message", "Message can't be empty")
      .not()
      .isEmpty()
  ],
  userControllers.postMessaging
);

router.post("/message/leave", userControllers.postLeaveChat);

router.post(
  "/create-message",
  [
    body("message")
      .not()
      .isEmpty()
      .withMessage("Please enter in a message"),
    body("recipients")
      .not()
      .isEmpty()
      .withMessage("Please select a recpient to send to")
  ],
  userControllers.postCreateMessage
);

router.post("/search", userControllers.searchUser);

router.get("/select-chat/:chatId", userControllers.getChat);

module.exports = router;
