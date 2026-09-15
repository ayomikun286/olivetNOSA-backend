import Notification from "../models/Notification.js";

const createNotification = async ({
    user,
    type,
    title,
    message,
    link = null,
}) => {
    try {
        return await Notification.create({
            user,
            type,
            title,
            message,
            link,
        });
    } catch (error) {
        console.error(
            "Create notification error:",
            error
        );

        return null;
    }
};

export default createNotification;