import "dotenv/config";
import connectDB from "../config/db.js";
import "../config/env.js";
import mongoose from "mongoose";
import dns from "dns";

dns.setServers(["8.8.8.8", "1.1.1.1"]);
dns.setDefaultResultOrder("ipv4first");

import { processObligationReminders } from "../services/obligationReminder.service.js";
import { processMembershipSuspensions } from "../services/membershipStatus.service.js";

const runDailyMembershipJob = async () => {
  try {
    console.log("========================================");
    console.log("Starting daily membership job...");
    console.log(new Date().toISOString());
    console.log("========================================");

    // Connect to MongoDB
    await connectDB();

    // ========================================
    // OBLIGATION REMINDERS
    // ========================================

    const reminderResult =
      await processObligationReminders();

    console.log("Obligation reminders completed:");
    console.log(reminderResult);

    // ========================================
    // MEMBERSHIP SUSPENSION CHECK
    // ========================================

    const suspensionResult =
      await processMembershipSuspensions();

    console.log("Membership suspension check completed:");
    console.log(suspensionResult);

    console.log("========================================");
    console.log("Daily membership job completed.");
    console.log(new Date().toISOString());
    console.log("========================================");

    process.exit(0);
  } catch (error) {
    console.error("========================================");
    console.error("Daily membership job failed:");
    console.error(error);
    console.error("========================================");

    process.exit(1);
  }
};

runDailyMembershipJob();