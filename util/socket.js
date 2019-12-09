let io;

module.exports = {
  init: httpServer => {
    io = require("socket.io")(httpServer);
    return io;
  },
  getIO: () => {
    if (!io) {
      throw new Error("Socket IO connection not established");
    }

    return io;
  }
};
