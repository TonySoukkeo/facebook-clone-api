const { validationResult } = require("express-validator/check");

const io = require("../util/socket");

const { filter } = require("p-iteration");

// Models
const Post = require("../models/post"),
  User = require("../models/user");

// Helper functions
const error = require("../util/error-handling/error-handler");

const { removeImage } = require("../util/images/image");

const {
  getPost,
  getCommentIndex,
  getExistingComment,
  getReplyIndex,
  populatePost
} = require("../util/post");

const { notifyLikes, notifyComment } = require("../util/notifications");

/**********************************
 *   Get Posts for current user   *
 **********************************/
module.exports.getPosts = async (req, res, next) => {
  try {
    let posts;

    // Check if user is authenticated
    if (!req.isAuth) {
      // If user is not authenticated, show all posts with privacy set to public
      posts = await Post.find({ privacy: "public" })
        .sort({ updatedAt: -1 })
        .populate("creator")
        .populate("likes", "firstName lastName fullName profileImage")
        .populate({
          path: "friends",
          populate: populatePost
        })
        .populate(populatePost);

      res.status(200).json({ posts });
    } else {
      // If user is authenticated, show posts that are on your friends list, plus your own as well with any post that is public

      const userId = req.userId;

      const user = await User.findById(userId)
        .populate("creator")
        .populate({
          path: "friends",
          populate: populatePost
        })
        .populate(populatePost);

      // Check if user is undefined
      if (!user) error.errorHandler(404, "User not found");

      // Grab all public posts
      post = await Post.find({
        $or: [{ privacy: "public" }, { creator: userId }]
      })
        .sort({ updatedAt: -1 })
        .populate("creator")
        .populate("likes", "firstName lastName fullName profileImage")
        .populate({
          path: "friends",
          populate: populatePost
        })
        .populate(populatePost);

      // Merge current users posts with friends posts
      posts = [...post];
      user.friends.forEach(friend => posts.push(...friend.posts));

      const postHash = {};

      posts.forEach(post => {
        if (!postHash[post._id]) postHash[post._id] = post;
      });

      posts = [...Object.values(postHash)];
      // Sort posts array by updated at date

      posts.sort((a, b) => b.updatedAt - a.updatedAt);

      res.status(200).json({ posts });
    }
  } catch (err) {
    error.error(err, next);
  }
};

/***********************
 *   Comment on Post   *
 ***********************/
module.exports.postComment = async (req, res, next) => {
  const postId = req.params.postId,
    content = req.body.content,
    image = req.file;

  try {
    // Check if user is authenticated
    if (!req.isAuth) error.errorHandler(403, "Not Authorized");

    const post = await getPost(postId);

    const userId = req.userId;

    const user = await User.findById(userId, "profileImage");

    // Check if user is undefined
    if (!user) error.errorHandler(404, "No user found");

    // Check if both content and postImage is empty
    if (!content && !image) {
      error.errorHandler(422, "Comment can't be empty");
    }

    // Check if there is a post image
    let imageUrl;

    if (image) {
      imageUrl = `https://facebook-clone--server.herokuapp.com/${image.filename}`;
    }

    // Create comment object
    const comment = {
      content,
      postImage: imageUrl,
      user: userId
    };

    // Push comment onto post comments array
    post.comments.push(comment);

    // Save comment to post in database
    await post.save();

    // Get updated post
    const updatedPost = await Post.findById(
      postId,
      "comments creator"
    ).populate("comments.user", "firstName lastName profileImage");

    // Don't send out notification if current user Id matches post creator id
    if (userId !== post.creator._id.toString()) {
      await notifyComment(
        post,
        updatedPost,
        postId,
        "post",
        "add",
        post,
        user.profileImage.imageUrl
      );
    }

    io.getIO().emit("posts", {
      action: "comment"
    });

    // Send response back to client
    res.status(200).json({ message: "Comment successfully added" });
  } catch (err) {
    error.error(err, next);
  }
};

/******************************
 *   Delete Comment on Post   *
 ******************************/
module.exports.postDeleteComment = async (req, res, next) => {
  const commentId = req.body.commentId,
    postId = req.params.postId;

  try {
    // Check if user is authenticated
    if (!req.isAuth) error.errorHandler(403, "Not authenticated");

    // Get main post that the comment is under
    const post = await getPost(postId, "comments");

    const userId = req.userId;

    // Check if comment still exists in the post
    const existingComment = getExistingComment(post, commentId);

    // Get comment index
    const commentIndex = getCommentIndex(post, commentId);

    // Check if current user id matches with comment id user._id
    if (existingComment.user.toString() !== userId.toString()) {
      error.errorHandler(403, "Not Authorized");
    }

    // Continue if there are no errors

    // Check if post comment has an image
    let postCommentImage = post.comments[commentIndex].postImage;

    if (postCommentImage) {
      removeImage(postCommentImage, null, "imageUrl");
    }

    // Get any associated pictures for all replies
    const postReplyImages = post.comments[commentIndex].replies.map(
      reply => reply.postImage
    );

    if (postReplyImages.length > 0) {
      postReplyImages.forEach(imageUrl =>
        removeImage(imageUrl, null, "imageUrl")
      );
    }

    // Pull comment from post comments array
    post.comments.pull(commentId);

    // Save updated post back to database
    await post.save();

    io.getIO().emit("posts", { action: "remove comment" });

    // Send response back to client
    res.status(200).json({ message: "Comment has been deleted" });
  } catch (err) {
    error.error(err, next);
  }
};

/******************************
 *    Edit comment on post    *
 ******************************/
module.exports.postEditComment = async (req, res, next) => {
  const postId = req.params.postId,
    content = req.body.content,
    commentId = req.body.commentId;

  try {
    // Check if user is authenticated
    if (!req.isAuth) error.errorHandler(403, "Not Authorized");

    // Get post
    const post = await getPost(postId, "comments");

    const userId = req.userId;

    // Check if both content and postImage is empty
    if (!content) {
      error.errorHandler(422, "Fields cannot be empty");
    }

    // Filter out comments array from commentId
    const commentPostIndex = post.comments.findIndex(
      post => post._id.toString() === commentId.toString()
    );

    // Check if comment exists
    if (commentPostIndex < 0) error.errorHandler(404, "Comment not found");

    // Verify if user id from comment matches current user's id
    const commentUserId = post.comments[commentPostIndex].user.toString();

    if (commentUserId !== userId.toString())
      error.errorHandler(403, "Not Authohrized");

    // Continue if there are no errors

    // Update post to new content
    post.comments[commentPostIndex].content = content;

    // Set edited property on comment
    post.comments[commentPostIndex].edited = Date.now();

    // Save changes to post back to database
    await post.save();

    // Return response back to client

    io.getIO().emit("posts", { action: "edit comment" });

    res.status(202).json({ message: "Post successfully updated" });
  } catch (err) {
    error.error(err, next);
  }
};

/******************************
 *    Add a like to a post    *
 ******************************/
module.exports.postAddLike = async (req, res, next) => {
  const postId = req.body.postId;

  try {
    // Check if user is authenticated
    if (!req.isAuth) error.errorHandler(403, "Not authorized");

    const post = await Post.findById(postId)
      .populate("likes", "firstName lastName profileImage")
      .populate("comments");
    const userId = req.userId;

    const user = await User.findById(userId, "profileImage");

    // Check if user exists
    if (!user) error.errorHandler(404, "No user found");

    // Check to see if currentUser hasn't already liked the post
    const alreadyLiked = post.likes.filter(
      post => post._id.toString() === userId.toString()
    );

    if (alreadyLiked.length !== 0) {
      return res.status(200).json({ status: 422 });
    }

    // Continue if there are no errors

    // Unshift current user into likes array of post
    await post.likes.push(req.userId);

    await post.save();

    // Get the updated post -- So population for new pushed user can work
    const updatedPost = await Post.findById(postId)
      .populate("likes", "firstName lastName profileImage")
      .populate("comments.user", "firstName lastName fullName profileImage")
      .populate("comments.likes", "firstName lastName fullName profileImage")
      .populate(
        "comments.replies.user",
        "firstName lastName fullName profileImage"
      )
      .populate("creator", "firstName lastName fullName profileImage");
    // Dont send any notifications if current userId matches the post creatorId
    if (userId !== post.creator._id.toString()) {
      await notifyLikes(
        post,
        updatedPost,
        postId,
        "post",
        "add",
        post,
        user.profileImage.imageUrl
      );
    }

    io.getIO().emit("posts", { action: "post like", post: updatedPost });

    io.getIO().emit("notification");

    // Send response back to client
    res.status(200).json({ message: "You have liked this post" });
  } catch (err) {
    error.error(err, next);
  }
};

/******************************
 *    Remove like from post    *
 ******************************/
module.exports.postRemoveLike = async (req, res, next) => {
  const postId = req.body.postId;

  try {
    // Check if user is authenticated
    if (!req.isAuth) error.errorHandler(403, "Not authorized");

    const post = await getPost(postId);

    const userId = req.userId;

    const user = await User.findById(userId, "profileImage");

    // Check if user exists
    if (!user) error.errorHandler(404, "No user found");

    // Check if user has not liked the post
    if (!post.likes.includes(userId))
      error.errorHandler(422, "No likes to remove");

    // Continue if there are no errors

    // Pull current userId from likes array
    post.likes.pull(req.userId);

    // Save post back to database
    await post.save();

    // Remove notification from post owner

    // Get updated post
    const updatedPost = await Post.findById(postId)
      .populate("likes", "firstName lastName profileImage")
      .populate("comments.user", "firstName lastName fullName profileImage")
      .populate("comments.likes", "firstName lastName fullName profileImage")
      .populate(
        "comments.replies.user",
        "firstName lastName fullName profileImage"
      )
      .populate("creator", "firstName lastName fullName profileImage");

    // Dont send any notifications if current userId matches the post creatorId
    if (userId !== post.creator._id.toString()) {
      await notifyLikes(
        post,
        updatedPost,
        postId,
        "post",
        "remove",
        post,
        user.profileImage.imageUrl
      );
    }

    io.getIO().emit("posts", { action: "remove post like", post: updatedPost });

    io.getIO().emit("notification");

    // Send response back to client
    res.status(200).json({ message: "Liked removed!", post: updatedPost });
  } catch (err) {
    error.error(err, next);
  }
};

/******************************
 *   Add a like to a Comment    *
 ******************************/
module.exports.postAddCommentLike = async (req, res, next) => {
  const postId = req.body.postId,
    commentId = req.body.commentId;

  try {
    // Check if user is authenticated
    if (!req.isAuth) error.errorHandler(403, "Not authorized");

    const post = await Post.findById(postId)
      .populate("comments.user", "firstName lastName profileImage")
      .populate("comments.likes", "firstName lastName profileImage");

    // Get comment index
    const commentIndex = getCommentIndex(post, commentId);

    const userId = req.userId;

    const user = await User.findById(userId, "profileImage");

    // Check if user exists
    if (!user) error.errorHandler(404, "No user found");

    // Check if currentUser already has liked the comment
    const alreadyLiked = post.comments[commentIndex].likes.filter(
      likes => likes._id.toString() === userId.toString()
    );

    if (alreadyLiked.length !== 0) {
      return res.status(200).json({ status: 422 });
    }

    // Continue if there are no errors

    // Unshift current user into comments like array
    post.comments[commentIndex].likes.unshift(req.userId);

    // Save post back to database
    await post.save();

    // Get post comments
    const updatedPost = await Post.findById(postId)
      .populate("creator", "firstName lastName fullName profileImage")
      .populate("comments.user", "firstName lastName fullName profileImage")
      .populate("comments.likes", "firstName lastName fullName profileImage")
      .populate(
        "comments.replies.likes",
        "firstName lastName fullName profileImage"
      )
      .populate(
        "comments.replies.user",
        "firstName lastName fullName profileImage"
      );

    // Don't notify user if current userId matches comments user id
    if (userId !== post.comments[commentIndex].user._id.toString()) {
      // Send notification to comment user
      notifyLikes(
        post.comments[commentIndex],
        updatedPost.comments[commentIndex],
        commentId,
        "comment",
        "add",
        post,
        user.profileImage.imageUrl
      );
    }

    io.getIO().emit("posts", { action: "add comment like", post: updatedPost });

    io.getIO().emit("notification");

    // Send response back to client
    res.status(200).json({ message: "You have liked this comment" });
  } catch (err) {
    error.error(err, next);
  }
};

/********************************
 *  Remove a like to a Comment  *
 ********************************/
module.exports.postRemoveCommentLike = async (req, res, next) => {
  const postId = req.body.postId,
    commentId = req.body.commentId;

  try {
    // Check if user is authenticated
    if (!req.isAuth) error.errorHandler(403, "Not authenticated");

    const post = await getPost(postId);

    // Check to see if comment still exists in post
    const commentIndex = getCommentIndex(post, commentId);

    const userId = req.userId;

    const user = await User.findById(userId, "profileImage");

    // Check if user exists
    if (!user) error.errorHandler(404, "No user found");

    // Check if user has a like on the comment
    const hasLiked = post.comments[commentIndex].likes.includes(userId);

    if (!hasLiked) error.errorHandler(422, "No likes to remove");

    // Continue if there are no errors

    // Pull current user from comments like array
    post.comments[commentIndex].likes.pull(req.userId);

    // Save post back to database
    await post.save();

    // Get updated post
    const updatedPost = await Post.findById(postId)
      .populate("creator", "firstName lastName fullName profileImage")
      .populate("comments.likes", "firstName lastName fullName profileImage")

      .populate("comments.user", "firstName lastName fullName profileImage")
      .populate(
        "comments.replies.likes",
        "firstName lastName fullName profileImage"
      )
      .populate(
        "comments.replies.user",
        "firstName lastName fullName profileImage"
      );

    // Get comment post
    const commentPost = updatedPost.comments[commentIndex];

    // Don't notify user if current userId matches comments user id
    if (userId !== commentPost.user._id.toString()) {
      await notifyLikes(
        commentPost,
        commentPost,
        commentId,
        "comment",
        "remove",
        post,
        user.profileImage.imageUrl
      );
    }

    io.getIO().emit("posts", {
      action: "remove comment like",
      post: updatedPost
    });

    io.getIO().emit("notification");

    // Send response back to client
    res.status(200).json({ message: "Like successfully removed" });
  } catch (err) {
    error.error(err, next);
  }
};

/******************************
 *   Add reply to a comment   *
 ******************************/
module.exports.postAddReply = async (req, res, next) => {
  const postId = req.params.postId,
    commentId = req.body.commentId,
    content = req.body.content,
    image = req.file,
    userId = req.body.userId;

  try {
    // Check if user is authenticated
    if (!req.isAuth) error.errorHandler(403, "Not authorized");

    const user = await User.findById(userId, "profileImage");

    // Check if user is undefined
    if (!user) error.errorHandler(404, "No user found");

    const post = await getPost(postId);

    // Check if post still exists
    if (!post) error.errorHandler(404, "Post no longer exists");

    // Check if comment still exists
    const commentIndex = getCommentIndex(post, commentId);

    // Continue if there are no errors

    // Check if an image is selected
    let imageUrl;

    if (image) {
      imageUrl = `${process.env.API_URI}/${image.filename}`;
    }

    // Create reply object with it's contents
    const reply = {
      content,
      postImage: imageUrl,
      user: userId
    };

    // Unshift reply onto comment reply array
    post.comments[commentIndex].replies.push(reply);

    // Save comments back to database
    await post.save();

    // Get updated post
    const updatedPost = await Post.findById(postId, "comments")
      .populate("comments.user")
      .populate("comments.replies.user");

    // Don't send a notification if current userId matches updatedPost comments userId
    if (req.userId !== updatedPost.comments[commentIndex].user._id.toString()) {
      // Send notification to post owner
      await notifyComment(
        updatedPost.comments[commentIndex],
        updatedPost.comments[commentIndex],
        commentId,
        "reply",
        "add",
        post,
        user.profileImage.imageUrl
      );
    }

    io.getIO().emit("posts", { action: "reply" });

    // Send response back to client
    res.status(200).json({ message: "Reply added successfully" });
  } catch (err) {
    error.error(err, next);
  }
};

/******************************
 *  Remove reply from comment *
 ******************************/
module.exports.postRemoveReply = async (req, res, next) => {
  const postId = req.params.postId,
    commentId = req.body.commentId,
    replyId = req.body.replyId;

  try {
    // Check if user is authenticated
    if (!req.isAuth) error.errorHandler(403, "Not authorized");

    const post = await getPost(postId, "comments");

    const userId = req.userId;

    // Check if comment still exists
    const commentIndex = getCommentIndex(post, commentId);

    // Check if reply still exists
    const replyIndex = post.comments[commentIndex].replies.findIndex(
      reply => reply._id.toString() === replyId.toString()
    );

    if (replyIndex < 0) error.errorHandler(404, "Comment not found");

    // Check if replies user id matches current userId
    if (
      post.comments[commentIndex].replies[replyIndex].user.toString() !==
      userId.toString()
    ) {
      error.errorHandler(403, "Not Authorized");
    }

    // Continue if there are no errors

    // Check if reply has any images
    const replyImage =
      post.comments[commentIndex].replies[replyIndex].postImage;

    if (replyImage) {
      removeImage(replyImage, null, "imageUrl");
    }

    // Remove reply from comment
    post.comments[commentIndex].replies.pull(replyId);

    // Save udpated post back to database
    await post.save();

    io.getIO().emit("posts", { action: "remove reply" });

    // Send response back to client
    res.status(200).json({ message: "Reply has been removed" });
  } catch (err) {
    error.error(err, next);
  }
};

/******************************
 *    Add a like to a reply   *
 ******************************/
module.exports.postReplyAddLike = async (req, res, next) => {
  const postId = req.body.postId,
    commentId = req.body.commentId,
    replyId = req.body.replyId;

  try {
    // Check if user is authorized
    if (!req.isAuth) error.errorHandler(403, "Not authorized");

    const post = await Post.findById(postId, "comments _id")
      .populate("comments.replies.user", "firstName lastName profileImage")
      .populate("comments.replies.likes", "firstName lastName profileImage");

    const commentIndex = getCommentIndex(post, commentId);

    // Check if reply comment is still there
    const replyIndex = getReplyIndex(post, commentIndex, replyId);

    const userId = req.userId;

    const user = await User.findById(userId, "profileImage");

    // Check if user exists
    if (!user) error.errorHandler(404, "No user found");

    // Check if user has already liked the comment
    const hasLiked = post.comments[commentIndex].replies[
      replyIndex
    ].likes.filter(user => user._id.toString() === userId.toString());
    if (hasLiked.length !== 0) {
      return res.status(200).json({ status: 422 });
    }

    // Continue if there are no errors

    // Add current user to likes array on replies
    post.comments[commentIndex].replies[replyIndex].likes.unshift(userId);

    // Save updated post back to database
    await post.save();

    // Get updated post
    const updatedPost = await Post.findById(postId)
      .populate("creator", "firstName lastName fullName profileImage")
      .populate("comments.user", "firstName lastName fullName profileImage")
      .populate("comments.replies.user", "firstName lastName profileImage")
      .populate("comments.replies.likes", "firstName lastName profileImage");

    // Get reply post itself
    const replyPost = updatedPost.comments[commentIndex].replies[replyIndex];

    // Dont send a notification if current userId matches reply post user id
    if (userId !== replyPost.user._id.toString()) {
      // Send notification to user
      await notifyLikes(
        replyPost,
        replyPost,
        replyId,
        "comment",
        "add",
        post,
        user.profileImage.imageUrl
      );
    }

    io.getIO().emit("posts", { action: "add reply like", post: updatedPost });

    io.getIO().emit("notification");

    // Send response back to client
    res.status(200).json({ message: "You have liked this comment" });
  } catch (err) {
    error.error(err, next);
  }
};

/******************************
 *   Remove like to a reply   *
 ******************************/
module.exports.postReplyRemoveLike = async (req, res, next) => {
  const postId = req.body.postId,
    commentId = req.body.commentId,
    replyId = req.body.replyId;

  try {
    // Check if user is authorized
    if (!req.isAuth) error.errorHandler(403, "Not authorized");

    // Get and check if post exist
    const post = await getPost(postId, "comments _id");

    // Check if comment still exists
    getExistingComment(post, commentId);

    // Get Comment Index
    const commentIndex = getCommentIndex(post, commentId);

    const userId = req.userId;

    const user = await User.findById(userId, "profileImage");

    // Check if user exists
    if (!user) error.errorHandler(404, "No user found");

    // Check if reply comment is still there
    const replyIndex = getReplyIndex(post, commentIndex, replyId);

    // Check if user has a like on the reply
    const hasLiked = post.comments[commentIndex].replies[
      replyIndex
    ].likes.includes(userId);

    if (!hasLiked) error.errorHandler(422, "No like to remove");

    // Continue if there are no errors

    // Pull current userId from likes array
    post.comments[commentIndex].replies[replyIndex].likes.pull(userId);

    // Save updated post to database
    await post.save();

    // Get updated post
    const updatedPost = await Post.findById(postId)
      .populate("creator", "firstName lastName fullName profileImage")
      .populate("comments.user", "firstName lastName fullName profileImage")
      .populate("comments.replies.user", "firstName lastName profileImage")
      .populate("comments.replies.likes", "firstName lastName profileImage");

    // Get reply comment
    const replyComment = updatedPost.comments[commentIndex].replies[replyIndex];

    // Dont send a notification if current userId matches reply post user id
    if (userId !== replyComment.user._id.toString()) {
      await notifyLikes(
        replyComment,
        replyComment,
        replyId,
        "comment",
        "remove",
        post,
        user.profileImage.imageUrl
      );
    }

    io.getIO().emit("posts", {
      action: "remove reply like",
      post: updatedPost
    });

    io.getIO().emit("notification");

    // Send response back to client
    res.status(200).json({ message: "Like successfully removed!" });
  } catch (err) {
    error.error(err, next);
  }
};

/********************
 *   Update reply  *
 ********************/
module.exports.postUpdateReply = async (req, res, next) => {
  const postId = req.params.postId,
    commentId = req.body.commentId,
    replyId = req.body.replyId,
    content = req.body.content;

  try {
    // Check for validation errors
    const validatorErrors = validationResult(req);
    error.validationError(validatorErrors);

    // Check if user is authenticated
    if (!req.isAuth) error.errorHandler(403, "Not authenticated");

    // Get and validate post
    const post = await getPost(postId, "comments");

    const userId = req.userId;

    // Check if comment still exists
    getExistingComment(post, commentId);

    // Get Comment Index
    const commentIndex = getCommentIndex(post, commentId);

    // Check if reply comment is still there
    const replyIndex = getReplyIndex(post, commentIndex, replyId);

    // Check if reply creator matches current userId
    const canEdit =
      post.comments[commentIndex].replies[replyIndex].user.toString() ===
      userId.toString();

    if (!canEdit) error.errorHandler(403, "Not authorized");

    // Continue if there are no errors

    post.comments[commentIndex].replies[replyIndex].content = content;

    // Save updated post back to database
    await post.save();

    io.getIO().emit("posts", { action: "edit reply" });

    // Send response back to client
    res.status(201).json({ message: "Reply successfully updated" });
  } catch (err) {
    error.error(err, next);
  }
};

/**************************
 *    Get notifications   *
 **************************/
module.exports.getNotifications = async (req, res, next) => {
  try {
    // Check if user is authenticated
    if (!req.isAuth)
      error.errorHandler(403, "You need to be logged in to see notifications");

    const userId = req.params.userId;

    const user = await User.findById(userId, "notifications");

    if (!user) error.errorHandler(404, "No user found");

    // Continue if there are no errors

    // Filter out content > payload > source post to see if the original post is still there

    user.notifications.content = await filter(
      user.notifications.content,
      async item => {
        if (item.payload.alertType !== "friend request") {
          const post = await Post.findById(item.payload.sourcePost);
          if (!post) return false;
        }

        if (!item.message) return false;

        return true;
      }
    );

    // Check to see if message in userNotification is null, if so pull that notification

    // Save user updated back to database
    await user.save();

    res.status(200).json({
      message: "Notifications fetched",
      notifications: user.notifications
    });
  } catch (err) {
    error.error(err, next);
  }
};

/**************************
 *   Clear notifications  *
 **************************/
module.exports.postClearNotifications = async (req, res, next) => {
  const userId = req.params.userId;
  const type = req.body.type;

  try {
    // check if user is authenticated
    if (!req.isAuth)
      error.errorHandler(403, "Must be logged in to see notifications");

    const user = await User.findById(userId, "notifications");

    if (!user) error.errorHandler(403, "Not Authorized");

    // Continue if there are no errors

    if (type === "clear") {
      // Clear content in user notifications if type is clear
      user.notifications.content = [];
    }

    // Set notification count to 0
    user.notifications.count = 0;

    // Save udpates back to database
    await user.save();

    io.getIO().emit("notification");

    // Send response back to user
    res.status(200).json({ message: "Notifications cleared" });
  } catch (err) {
    error.error(err, next);
  }
};

/**************************
 *    Clear Messages  *
 **************************/
module.exports.postClearMessage = async (req, res, next) => {
  try {
    const userId = req.userId;

    // Check to see if user is authenticated
    if (!req.isAuth) error.errorHandler(403, "Not Authorized");

    const user = await User.findById(userId, "messages");

    // Check if user in undefined
    if (!user) error.errorHandler(404, "No user found");

    // reset messages count to 0
    user.messages.count = 0;

    await user.save();

    res.status(200).json({ message: "Messages count cleared" });
  } catch (err) {
    error.error(err, next);
  }
};

/************************
 *    Get Single Post   *
 ************************/
module.exports.getPost = async (req, res, next) => {
  const postId = req.params.postId;

  try {
    // Check if user is authenticated
    if (!req.isAuth) error.errorHandler(403, "Not authorized");

    // Get post
    const post = await Post.findById(postId)
      .populate("likes", "firstName lastName profileImage fullName")
      .populate("creator", "profileImage fullName firstName lastName")
      .populate("comments.user", "firstName lastName fullName profileImage")
      .populate("comments.likes", "firstName lastName profileImage fullName")
      .populate(
        "comments.replies.user",
        "firstName lastName fullName profileImage"
      )
      .populate(
        "comments.replies.likes",
        "firstName lastName profileImage fullName"
      );
    // Check if post is undefined

    if (!post) error.errorHandler(404, "Post not found");

    // Continue if there are no errors

    // return post to client
    res.status(200).json({ message: "Post fetched!", post });
  } catch (err) {
    error.error(err, next);
  }
};

/************************
 *  Update Single Post  *
 ************************/
module.exports.editPost = async (req, res, next) => {
  const postId = req.body.postId,
    content = req.body.content;

  try {
    // Check if user is authenticated
    if (!req.isAuth) error.errorHandler(403, "Not authorized");

    // Check for validation errors
    const validatorErrors = validationResult(req);
    error.validationError(validatorErrors);

    const post = await Post.findById(postId, "content");

    // Check if post is undefined
    if (!post) error.errorHandler(404, "No post found");

    // Continue if there are no errors
    post.content = content;

    // Save post updates back to database
    await post.save();

    io.getIO().emit("posts", { action: "update" });

    // Send response back to client
    res.status(201).json({ message: "Post updated!" });
  } catch (err) {
    error.error(err, next);
  }
};

/************************
 *    Get Post Privacy  *
 ************************/
module.exports.getPostPrivacy = async (req, res, next) => {
  const postId = req.params.postId;

  try {
    // Check if user is authenticated
    if (!req.isAuth) error.error(403, "Not authorized");

    const userId = req.userId;

    // Get post
    const post = await Post.findById(postId, "privacy creator");

    // Check if userId matches the creatorId
    if (userId.toString() !== post.creator.toString()) {
      error.errorHandler(403, "Not authorized");
    }

    // Check if post is undefined
    if (!post) error.errorHandler(404, "Post not found");

    // Continue if there are no errors

    // Return post to client
    res.status(200).json({
      message: "Post fetched!",
      privacy: post.privacy,
      creatorId: post.creator
    });
  } catch (err) {
    error.error(err, next);
  }
};

/************************
 *  Change post privacy *
 ************************/
module.exports.postChangePostPrivacy = async (req, res, next) => {
  const privacy = req.body.privacy,
    postId = req.body.postId;

  try {
    // Check if user is authenticated
    if (!req.isAuth) error.errorHandler(403, "Not authorized");

    // Get and validate post
    const post = await Post.findById(postId, "creator privacy");

    const userId = req.userId;

    // Check if current user id matches creator id
    if (post.creator.toString() !== userId.toString()) {
      error.errorHandler(403, "Not Authorized");
    }

    // Continue if there are no errors

    // Change privacy of the post
    post.privacy = privacy;

    // Save changes back to database
    await post.save();

    io.getIO().emit("posts", {
      action: "edit privacy",
      postData: { privacy, postId }
    });

    // Send response back to client
    res.status(201).json({ message: "Privacy changed" });
  } catch (err) {
    error.error(err, next);
  }
};
