const mongoose = require("mongoose");
const Grid = require("gridfs-stream");
const ObjectId = mongoose.Types.ObjectId;
// Set up mongoose connection
const conn = mongoose.createConnection(process.env.MONGO_URI);

// Set up gridfs stream
let gfs;

conn.once("open", () => {
  gfs = Grid(conn.db, mongoose.mongo);
  gfs.collection("uploads");
});

module.exports = {
  removeImage: async (filename, fileId, type = "id") => {
    // Check to make sure that filename isn't equal to the default filename set
    if (
      filename ===
      `${process.env.API_URI}/2019-11-18T06:45:32.876Z-placeholder-profile-image.jpeg`
    )
      return;

    if (
      filename === `${process.env.API_URI}/2019-11-17T22:01:19.998Z-banner.png`
    )
      return;

    // Remove file from uploads.files
    if (type === "id") {
      gfs.remove(
        { _id: ObjectId(`${fileId}`), root: "uploads" },
        (err, gridStore) => {
          if (err) return console.log(err);
          return;
        }
      );
    } else {
      const name = filename.split(`${process.env.API_URI}/`)[1];

      gfs.remove({ filename: name, root: "uploads" }, (err, gridStore) => {
        if (err) return console.log(err);
        return;
      });
    }
  }
};
