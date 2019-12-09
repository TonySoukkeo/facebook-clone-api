const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const userSchema = new Schema(
  {
    firstName: {
      type: String,
      required: true
    },
    lastName: {
      type: String,
      required: true
    },
    password: {
      type: String,
      required: true
    },
    dateOfBirth: {
      type: Date,
      required: true
    },
    profileImage: {
      imageUrl: {
        type: String,
        required: true,
        default: `${process.env.API_URI}/2019-11-18T06:45:32.876Z-placeholder-profile-image.jpeg`
      },
      imageId: {
        type: Schema.Types.ObjectId,
        required: true,
        default: "5dd23e0c89dfb24e3c6e1d1a"
      }
    },
    bannerImage: {
      imageUrl: {
        type: String,
        required: true,
        default: `${process.env.API_URI}/2019-11-17T22:01:19.998Z-banner.png`
      },
      imageId: {
        type: Schema.Types.ObjectId,
        required: true,
        default: "5dd1c3304486023f587d4666"
      }
    },
    details: {
      email: {
        type: String,
        required: true
      },
      about: {
        type: String,
        required: true,
        default: "No info"
      },
      gender: {
        type: String,
        required: true
      },
      occupation: {
        type: String,
        required: true,
        default: "No info"
      }
    },
    friends: [
      {
        type: Schema.Types.ObjectId,
        required: true,
        ref: "User"
      }
    ],
    posts: [
      {
        type: Schema.Types.ObjectId,
        ref: "Post",
        required: true
      }
    ],
    notifications: {
      count: {
        type: Number,
        required: true,
        default: 0
      },
      content: [
        {
          payload: {
            originalId: {
              type: Schema.Types.ObjectId,
              ref: "Post"
            },
            content: String,
            alertType: {
              type: String,
              required: true
            },
            friendId: {
              type: Schema.Types.ObjectId,
              ref: "User"
            },
            sourcePost: {
              type: Schema.Types.ObjectId,
              ref: "Post"
            },
            userImage: String
          },
          message: {
            type: String
          },
          date: {
            type: Date,
            default: Date.now
          }
        }
      ]
    },
    requests: {
      count: {
        type: Number,
        required: true,
        default: 0
      },
      content: [
        {
          user: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true
          },
          date: {
            type: Date,
            default: Date.now
          },
          friendId: {
            type: Schema.Types.ObjectId,
            ref: "User"
          }
        }
      ]
    },
    messages: {
      count: {
        type: Number,
        required: true,
        default: 0
      },
      content: [
        {
          type: Schema.Types.ObjectId,
          required: true,
          ref: "Chat"
        }
      ]
    },
    resetToken: String,
    resetExpiration: Date
  },
  {
    toJSON: { virtuals: true }
  }
);

userSchema.virtual("fullName").get(function() {
  return `${this.firstName} ${this.lastName}`;
});

module.exports = mongoose.model("User", userSchema);
