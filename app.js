import "./config/env.js";
import session from "express-session";
import express from "express";
import cors from "cors";

import AdminRoute from "./routes/AdminRoutes.js"
import {corsOptions} from "./config/cors.js";
import {sessionConfig} from "./config/session.js";
import connectDB from "./config/db.js";
import chapterRoutes from "./routes/chapter.routes.js";
import paymentRoutes from "./routes/paymentRoutes.js";
import yearSetRoutes from "./routes/yearSet.routes.js";
import userRoutes from "./routes/auth.js"
import cookieParser from "cookie-parser";
import Notification from "./routes/notificationRoutes.js";
import obligationRoutes from "./routes/obligationRoutes.js";
import obligationAssignmentRoutes from "./routes/obligationAssignmentRoutes.js"
import dns from "dns";

dns.setServers(["8.8.8.8", "1.1.1.1"]);
dns.setDefaultResultOrder("ipv4first");
const app = express();
const PORT = process.env.PORT || 5000;

// mongoose
app.use(express.json());
app.use(cors(corsOptions));
app.use(cookieParser());
app.use(session(sessionConfig));







 app.get("/", (req, res) => {
      res.send("Welcome to the NOSA Alumni API");
    });

app.use("/api/chapters", chapterRoutes);
app.use("/api/yearSet", yearSetRoutes);
app.use(userRoutes)
app.use("/api", AdminRoute)

app.use("/api/obligations", obligationRoutes);
app.use( obligationAssignmentRoutes)
app.use("/api/notifications", Notification)
app.use("/api/payments", paymentRoutes);


    

const startServer = async () => {
  try {
    
    await connectDB();
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error("❌ Failed to start server:", error.message);
    process.exit(1);
  }
};

startServer();





