const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const chatSchema = new Schema({
  users: [
    {
      userId: {
        type: Schema.Types.ObjectId,
        required: true,
        ref: "User"
      }
    }
  ],
  messages: [
    {
      user: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true
      },
      message: {
        type: String,
        required: true
      },
      date: {
        type: Date,
        default: Date.now,
        required: true
      }
    }
  ]
});

module.exports = mongoose.model("Chat", chatSchema);
