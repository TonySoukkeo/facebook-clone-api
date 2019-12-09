const dotenv = require("dotenv");
const multer = require("multer");
const express = require("express");
const mongoose = require("mongoose");
const Grid = require("gridfs-stream");
const error = require("./util/error-handling/error-handler");
const GridFSStorage = require("multer-gridfs-storage");
const bodyParser = require("body-parser");
const isAuth = require("./util/is-auth/isAuth");
const compression = require("compression");

// Setup dotenv
dotenv.config();

// Set up mongoose connection
const conn = mongoose.createConnection(process.env.MONGO_URI);

// Set up gridfs stream
let gfs;

conn.once("open", () => {
  gfs = Grid(conn.db, mongoose.mongo);
  gfs.collection("uploads");
});

// Set up storage for multer to store in mongodb
const storage = new GridFSStorage({
  url: process.env.MONGO_URI,
  file: (req, file) => {
    return new Promise((resolve, reject) => {
      const filename = `${new Date().toISOString()}-${file.originalname}`;

      const fileInfo = {
        filename: filename,
        bucketName: "uploads"
      };
      resolve(fileInfo);
    });
  }
});

// Set up filefilter for multer
const fileFilter = (req, file, cb) => {
  // Check for valid file types
  if (
    file.mimetype === "image/jpg" ||
    file.mimetype === "image/jpeg" ||
    file.mimetype === "image/png"
  ) {
    cb(null, true);
  } else {
    cb(null, false);
  }
};

// Routes
const authRoutes = require("./routes/auth"),
  userRoutes = require("./routes/user"),
  feedRoutes = require("./routes/feed"),
  profileRoutes = require("./routes/profile");

const app = express();

app.use(compression());

// Parse incoming requests
app.use(bodyParser.json());
app.use(multer({ storage, fileFilter }).single("image"));

// Set headers
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, , X-Requested-With, Origin, Accept"
  );
  res.setHeader(
    "Access-Control-Allow-Methods",
    "OPTIONS, GET, POST, PUT, PATCH, DELETE"
  );

  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }

  next();
});

// Authentification check
app.use(isAuth);

// Get images from database
app.get("/:imageName", async (req, res, next) => {
  const filename = req.params.imageName;
  try {
    // Read output to browser
    const readstream = gfs.createReadStream(filename, {
      highWaterMark: Math.pow(20, 40)
    });

    readstream.pipe(res);
  } catch (err) {
    error.error(err, next);
  }
});

// Endpoints
app.use("/feed", feedRoutes);

app.use("/auth", authRoutes);

app.use("/user", userRoutes);

app.use("/profile", profileRoutes);

// Error handler
app.use((err, req, res, next) => {
  const status = err.statusCode,
    message = err.message,
    type = err.type || "";

  res.status(status).json({ message, status, type });
});

mongoose
  .connect(process.env.MONGO_URI)
  .then(result => {
    const server = app.listen(process.env.PORT || 8080);

    const io = require("./util/socket").init(server);

    io.on("connection", socket => {});
  })
  .catch(err => console.log(err));
