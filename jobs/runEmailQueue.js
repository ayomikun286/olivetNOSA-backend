import "dotenv/config";
import mongoose from "mongoose";
import dns from "dns";

import { processEmailQueue } from "../services/emailQueueWorker.service.js";

dns.setServers(["8.8.8.8", "1.1.1.1"]);
dns.setDefaultResultOrder("ipv4first");

const runEmailQueue = async () => {
    try {
        if (!process.env.MONGO_URI) {
            throw new Error("Missing MONGO_URI");
        }

        await mongoose.connect(process.env.MONGO_URI);

        console.log("MongoDB connected.");
        console.log("Starting email queue worker...");

        const result = await processEmailQueue();

        console.log("Email queue processing result:");
        console.log(result);

        console.log("Email queue worker finished.");

    } catch (error) {
        console.error("Email queue worker failed:", error);
        process.exitCode = 1;

    } finally {
        if (mongoose.connection.readyState !== 0) {
            await mongoose.disconnect();
            console.log("MongoDB disconnected.");
        }
    }
};

await runEmailQueue();