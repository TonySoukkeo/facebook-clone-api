// Models
const User = require("../models/user");

module.exports = {
  /*****************************************
   *  Manage notifications for like/unlike *
   *****************************************/
  notifyLikes: async (
    post,
    updatedPost,
    postId,
    type,
    action,
    sourcePost,
    senderImageUrl
  ) => {
    let notifyUser;

    switch (type) {
      case "post":
        notifyUser = await User.findById(
          post.creator._id.toString(),
          "notifications"
        );
        break;

      case "comment":
        notifyUser = await User.findById(
          post.user._id.toString(),
          "notifications"
        );
        break;

      default:
        return;
    }

    // Send a notification to post creator

    // Generate message
    const message = generateMessage(updatedPost, action, "like");

    let existingNotify;

    // Check if like count is 0, if so remove notification entirely from user if action is remove

    if (message.count <= 0 && action === "remove") {
      // Get notification id
      existingNotify = notifyUser.notifications.content.find(
        item => item.payload.originalId.toString() === postId.toString()
      );

      if (existingNotify) {
        // Pull notification from notifyUsers notification object array
        await notifyUser.notifications.content.pull(existingNotify._id);
      }

      // Subtract count from notifications
      const count = notifyUser.notifications.count - 1;

      notifyUser.notifications.count = count;

      // Save notifyUser back to database
      await notifyUser.save();

      return;
    }

    // Check if notifyUser doesn't already have a notification associated with this post
    const hasNotification = notifyUser.notifications.content.filter(item => {
      if (item.payload.originalId) {
        if (
          item.payload.originalId.toString() === postId.toString() &&
          item.payload.alertType === "like"
        ) {
          return item;
        }
      }
    });

    // Create notification message
    const notifyMessage = {
      payload: {
        originalId: post._id,
        content: post.content,
        alertType: "like",
        sourcePost: sourcePost._id,
        userImage: senderImageUrl
      },
      message: message.message
    };

    if (hasNotification.length === 0) {
      // Unshift notificationMessage to notifyUser notifications array
      notifyUser.notifications.content.unshift(notifyMessage);
    } else {
      // Get notify id
      existingNotify = notifyUser.notifications.content.find(item => {
        if (item.payload.originalId) {
          if (
            item.payload.originalId.toString() === postId.toString() &&
            item.payload.alertType === "like"
          ) {
            return item;
          }
        }
      });

      // Pull existing notification from notify user
      await notifyUser.notifications.content.pull(existingNotify._id);

      // Unshift new notifyMessage onto notifyUser
      await notifyUser.notifications.content.unshift(notifyMessage);
    }

    // Update count for notification
    let count;

    switch (action) {
      case "add":
        count = notifyUser.notifications.count + 1;
        break;

      case "remove":
        count = notifyUser.notifications.count - 1;
        break;

      default:
        return;
    }

    notifyUser.notifications.count = count;

    // Save updated to database
    await updatedPost.save();
    await notifyUser.save();
  },
  /*****************************************
   *  Manage notifications for commenting *
   *****************************************/
  notifyComment: async (
    post,
    updatedPost,
    postId,
    type,
    action,
    sourcePost,
    senderImageUrl
  ) => {
    let notifyUser;

    switch (type) {
      case "post":
        notifyUser = await User.findById(
          post.creator.toString(),
          "notifications"
        );
        break;

      case "comment":
      case "reply":
        notifyUser = await User.findById(
          post.user._id.toString(),
          "notifications"
        );
        break;

      default:
        return;
    }

    // Send notification to post creator
    let messageString;

    if (type === "comment" || type === "post") messageString = "commented on";
    else if (type === "reply") messageString = "replied to";

    // Generate message
    const message = generateMessage(updatedPost, action, messageString);

    let existingNotify;

    // Check if comment count is 0, if so remove notification entirely from user if action is remove
    if (message.count <= 0 && action === "remove") {
      // Get notification id
      existingNotify = notifyUser.notifications.content.find(
        item => item.payload.originalId.toString() === postId.toString()
      );

      // Pull notification from notifyUsers notification object array
      await notifyUser.notifications.content.pull(existingNotify._id);

      // Subtract count from notifications
      const count = notifyUser.notifications.count - 1;

      notifyUser.notifications.count = count;

      // Save notifyUser back to database
      await notifyUser.save();

      return;
    }

    // Check if notifyUser doesn't already have a notification associated with this post
    const hasNotification = notifyUser.notifications.content.filter(item => {
      if (item.payload.originalId) {
        if (
          item.payload.originalId.toString() === postId.toString() &&
          item.payload.alertType === "comment"
        ) {
          return item;
        }
      }
    });

    // Create notification message
    const notifyMessage = {
      payload: {
        originalId: post._id,
        content: post.content,
        alertType: "comment",
        sourcePost: sourcePost._id,
        userImage: senderImageUrl
      },
      message: message.message
    };

    if (hasNotification.length === 0) {
      // Unshift notificationMessage to notifyUser notifications array
      notifyUser.notifications.content.unshift(notifyMessage);
    } else {
      // Get notify id
      existingNotify = notifyUser.notifications.content.find(item => {
        if (item.payload.originalId) {
          if (
            item.payload.originalId.toString() === postId.toString() &&
            item.payload.alertType === "comment"
          ) {
            return item;
          }
        }
      });

      // Pull existing notification from notify user
      await notifyUser.notifications.content.pull(existingNotify._id);

      // Unshift new notifyMessage onto notifyUser
      await notifyUser.notifications.content.unshift(notifyMessage);
    }

    // Update count for notification
    let count;

    switch (action) {
      case "add":
        count = notifyUser.notifications.count + 1;
        break;

      case "remove":
        count = notifyUser.notifications.count - 1;
        break;

      default:
        return;
    }

    notifyUser.notifications.count = count;

    // Save updated to database
    await updatedPost.save();
    await notifyUser.save();
  },
  notifyFriend: async (currentUser, requestingUser, type) => {
    // Check if both user doesn't already have an existing notification
    const currentUserNotification = currentUser.notifications.content.filter(
      item => {
        if (item.payload.friendId)
          item.payload.friendId.toString() === requestingUser._id.toString() &&
            item.payload.alertType === type;
      }
    );

    const requestingUserNotification = requestingUser.notifications.content.filter(
      item => {
        if (item.payload.friendId) {
          item.payload.friendId.toString() === currentUser._id.toString() &&
            item.payload.alertType === type;
        }
      }
    );

    // Doesn't have a notification for this request
    if (currentUserNotification.length <= 0) {
      // Create notificatino for current user
      const content = {
        payload: {
          alertType: type,
          friendId: requestingUser._id,
          userImage: requestingUser.profileImage.imageUrl
        },
        date: Date.now(),
        message: `You and ${requestingUser.firstName} ${requestingUser.lastName} are now friends`
      };

      // Unshift payload onto currentUser content
      currentUser.notifications.content.unshift(content);

      // Add count to notification
      currentUser.notifications.count = currentUser.notifications.count + 1;
    }

    if (requestingUserNotification.length <= 0) {
      // Create notificatino for current user
      const content = {
        payload: {
          alertType: type,
          friendId: currentUser._id,
          userImage: currentUser.profileImage.imageUrl
        },
        date: Date.now(),
        message: `You and ${currentUser.firstName} ${currentUser.lastName} are now friends`
      };

      // Unshift payload onto currentUser content
      requestingUser.notifications.content.unshift(content);

      // Add count to notification
      requestingUser.notifications.count =
        requestingUser.notifications.count + 1;
    }
  }
};

function generateMessage(updatedPost, action, string) {
  // Check the length of post likes
  let message = "",
    count,
    user;

  if (string === "like") {
    count = updatedPost.likes.length;
    user = updatedPost.likes;
  } else {
    // Filter out updatedPost.comments to unique users only
    const userHash = {};

    let property;

    if (string === "commented on") property = "comments";
    else if (string === "replied to") property = "replies";

    updatedPost[property].forEach(item => {
      if (!userHash[item.user._id]) {
        userHash[item.user._id] = {
          firstName: item.user.firstName,
          lastName: item.user.lastName
        };
      }
    });
    user = [...Object.values(userHash)];
    count = user.length;
  }

  if (count === 0 && action === "remove") {
    return {
      message: null,
      count
    };
  }

  if (count === 2) {
    message += `${user[count - 1].firstName} ${user[count - 1].lastName} and `;
    message += `${user[count - 2].firstName} ${
      user[count - 2].lastName
    } ${string} your post`;
  } else if (count > 2) {
    message += `${user[count - 1].firstName} ${user[count - 1].lastName}, `;
    message += `${user[count - 2].firstName} ${user[count - 1].lastName} and `;
    message += `${count - 2} others ${string} your post`;
  } else {
    message += `${user[count - 1].firstName} ${
      user[count - 1].lastName
    } ${string} your post`;
  }

  return {
    message,
    count
  };
}
