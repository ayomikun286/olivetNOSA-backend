import Notification from "../models/Notification.js";



export const createNotification = async ({
    userId,
    type,
    title,
    message,
    link = null,
}) => {
    try {
        if (!userId) {
            console.warn("Notification skipped: userId is missing");
            return null;
        }

        const notification = await Notification.create({
            user: userId,
            type,
            title,
            message,
            link,
        });

        return notification;
    } catch (error) {
        // Notification failure should not break the main transaction
        console.error("Create notification error:", error.message);
        return null;
    }
};