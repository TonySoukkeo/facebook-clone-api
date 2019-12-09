const { body } = require("express-validator/check");

const express = require("express");
const router = express.Router();

// Controllers
const feedControllers = require("../controllers/feed");

router.get("/posts", feedControllers.getPosts);

router.get("/posts/privacy/:postId", feedControllers.getPostPrivacy);
router.patch("/posts/privacy", feedControllers.postChangePostPrivacy);

router.post("/comment/:postId", feedControllers.postComment);
router.delete("/comment/:postId", feedControllers.postDeleteComment);
router.patch("/comment/:postId", feedControllers.postEditComment);

router.post("/post/like", feedControllers.postAddLike);
router.delete("/post/like", feedControllers.postRemoveLike);

router.post("/post/comment/like", feedControllers.postAddCommentLike);
router.delete("/post/comment/like", feedControllers.postRemoveCommentLike);

router.post("/post/reply/:postId", feedControllers.postAddReply);
router.delete("/post/reply/:postId", feedControllers.postRemoveReply);
router.patch(
  "/post/reply/:postId",
  [
    body("content", "Reply content cannot be empty")
      .not()
      .isEmpty()
  ],
  feedControllers.postUpdateReply
);

// Add and remove like from post reply
router.post("/reply/like", feedControllers.postReplyAddLike);
router.delete("/reply/like", feedControllers.postReplyRemoveLike);

router.get("/notifications/:userId", feedControllers.getNotifications);
router.delete("/notifications/:userId", feedControllers.postClearNotifications);

router.delete("/messages/", feedControllers.postClearMessage);

router.get("/post/:postId", feedControllers.getPost);
router.patch(
  "/post",
  [
    body("content", "Post cannot be empty")
      .not()
      .isEmpty()
  ],
  feedControllers.editPost
);

module.exports = router;
