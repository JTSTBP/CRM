// const express = require('express');
// const mongoose = require('mongoose');
// const dotenv = require('dotenv');
// const cors = require('cors');
// const path = require("path");

// // Load environment variables
// dotenv.config();

// const app = express();
// const PORT = process.env.PORT || 5000;

// // Middleware
// app.use(cors());
// app.use(express.json());

// // Database Connection
// mongoose.connect(process.env.MONGO_URI)
//   .then(() => {
//     console.log("DB connected");
//     startNotificationJob(); // Start push notification background job
//     startBDDailyReportJob(); // Start BD executive daily report scheduler

//     app.listen(PORT || 5000, () => {
//       console.log("Server running");
//     });
//   })
//   .catch(err => {
//     console.error("DB connection failed:", err);
//     process.exit(1);
//   });

// // Routes
// const authRoutes = require('./routes/authRoutes');
// const leadRoutes = require('./routes/leadRoutes');
// const taskRoutes = require('./routes/taskRoutes');
// const pushRoutes = require('./routes/pushRoutes');
// const pocBucketRoutes = require('./routes/pocBucket');
// const dashboardRoutes = require('./routes/dashboardRoutes');
// const attendanceRoutes = require('./routes/attendanceRoutes');
// const emailLeadRoutes = require('./routes/emailLeadRoutes');
// const { startNotificationJob } = require('./notificationJob');
// const bdDailyReportRoutes = require('./routes/bdDailyReportRoutes');
// const { startBDDailyReportJob } = require('./bdDailyReportJob');

// app.use('/api/auth', authRoutes);
// app.use('/api/leads', leadRoutes);
// app.use('/api/tasks', taskRoutes);
// app.use('/api/push', pushRoutes);
// app.use('/api/poc-bucket', pocBucketRoutes);
// app.use('/api/dashboard', dashboardRoutes);
// app.use('/api/attendance', attendanceRoutes);
// app.use('/api/email-leads', emailLeadRoutes);
// app.use('/api/bd-daily-reports', bdDailyReportRoutes);

// app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
// app.use(express.static(path.join(__dirname, "dist")));

// app.use((req, res) => {
//     res.sendFile(path.join(__dirname, "dist", "index.html"));
// });
// // Basic Route


// // Server start moved to DB connection block



const express = require("express");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const cors = require("cors");
const path = require("path");

// Load environment variables
dotenv.config({ path: path.join(__dirname, ".env") });

const app = express();
const PORT = process.env.PORT || 5000;

// ==================== CORS CONFIGURATION ====================


const allowedOrigins = [
  "https://jobsterritory-crm-frontend.onrender.com",
  "http://localhost:5173",
  process.env.FRONTEND_URL,
].filter(Boolean).map((url) => url.replace(/\/$/, ""));

const corsOptions = {
  origin: (origin, callback) => {
    // Allow server-to-server requests and approved frontend origins
    if (!origin || allowedOrigins.includes(origin.replace(/\/$/, ""))) {
      return callback(null, true);
    }

    console.error("CORS blocked origin:", origin);
    return callback(new Error("Origin not allowed by CORS"));
  },
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "x-auth-token",
  ],
  optionsSuccessStatus: 204,
};

app.use(cors(corsOptions));
app.use(express.json());

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      console.error("CORS blocked origin:", origin);
      return callback(null, false);
    },
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "x-auth-token",
    ],
    optionsSuccessStatus: 204,
  })
);

app.use(express.json());

// ==================== ROUTES ====================

const authRoutes = require("./routes/authRoutes");
const leadRoutes = require("./routes/leadRoutes");
const taskRoutes = require("./routes/taskRoutes");
const pushRoutes = require("./routes/pushRoutes");
const pocBucketRoutes = require("./routes/pocBucket");
const dashboardRoutes = require("./routes/dashboardRoutes");
const attendanceRoutes = require("./routes/attendanceRoutes");
const emailLeadRoutes = require("./routes/emailLeadRoutes");
const bdDailyReportRoutes = require("./routes/bdDailyReportRoutes");

const {
  startNotificationJob,
} = require("./notificationJob");

const {
  startBDDailyReportJob,
} = require("./bdDailyReportJob");

// Backend welcome route
app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Welcome to CRM Backend API!",
    status: "Running",
    timestamp: new Date().toISOString(),
  });
});

// Existing CRM APIs — paths preserved
app.use("/api/auth", authRoutes);
app.use("/api/leads", leadRoutes);
app.use("/api/tasks", taskRoutes);
app.use("/api/push", pushRoutes);
app.use("/api/poc-bucket", pocBucketRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/attendance", attendanceRoutes);
app.use("/api/email-leads", emailLeadRoutes);
app.use("/api/bd-daily-reports", bdDailyReportRoutes);

// Uploaded files
app.use(
  "/uploads",
  express.static(path.join(__dirname, "uploads"))
);

// Unknown API routes return JSON instead of frontend HTML
app.use("/api", (req, res) => {
  res.status(404).json({
    success: false,
    message: "API endpoint not found",
  });
});

// ==================== DATABASE & SERVER ====================

mongoose.set("strictQuery", false);

const startServer = async () => {
  try {
    if (!process.env.MONGO_URI) {
      throw new Error("MONGO_URI is not configured");
    }

    console.log("Connecting to MongoDB...");

    const conn = await mongoose.connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 20000,
    });

    console.log(`MongoDB connected: ${conn.connection.host}`);

    app.listen(PORT, "0.0.0.0", () => {
      console.log(`CRM backend running on port ${PORT}`);
    });

    // Start existing background jobs after DB connection
    startNotificationJob();
    startBDDailyReportJob();

  } catch (error) {
    console.error("CRM startup failed:", error.message);
    process.exit(1);
  }
};

startServer();

// Database connection monitoring
mongoose.connection.on("error", (err) => {
  console.error("MongoDB connection error:", err);
});

mongoose.connection.on("disconnected", () => {
  console.log("MongoDB disconnected");
});

mongoose.connection.on("reconnected", () => {
  console.log("MongoDB reconnected");
});
