// Models
const Chat = require("../models/chat");

// Helper functions
const error = require("../util/error-handling/error-handler");

module.exports = {
  getChat: async chatId => {
    const chat = await Chat.findById(chatId);

    if (!chat) error.errorHandler(404, "No message exists");

    return chat;
  },
  validChatUser: (chat, userId) => {
    const validUser = chat.users.find(
      user => user.userId.toString() === userId.toString()
    );

    if (!validUser) error.errorHandler(403, "Not Authorized");
  }
};
