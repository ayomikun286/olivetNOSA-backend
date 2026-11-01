
import Notification from "../models/Notification.js";

export const createNotification = async ({
  userId,
  type,
  title,
  message,
  link = null,
  deduplicationKey = null,
  throwOnError = false,
}) => {
  try {
    if (!userId) {
      console.warn("Notification skipped: userId is missing");
      return null;
    }

    // Reuse an existing notification when its key already exists.
    if (deduplicationKey) {
      return await Notification.findOneAndUpdate(
        { deduplicationKey },
        {
          $setOnInsert: {
            user: userId,
            type,
            title,
            message,
            link,
            deduplicationKey,
          },
        },
        {
          upsert: true,
          new: true,
          runValidators: true,
          setDefaultsOnInsert: true,
        }
      );
    }

    // Preserve existing behavior for other notifications.
    return await Notification.create({
      user: userId,
      type,
      title,
      message,
      link,
    });
  } catch (error) {
  console.error("Create notification error:", error.message);

  if (throwOnError) {
    throw error;
  }

  return null;
}
};



export const notifyUsers = async ({
  userIds,
  type,
  title,
  message,
  link,
  deduplicationKey,
}) => {
  const uniqueUserIds = [
    ...new Set(userIds.filter(Boolean).map(String)),
  ];

  return Promise.all(
    uniqueUserIds.map((userId) =>
      createNotification({
        userId,
        type,
        title,
        message,
        link,
        deduplicationKey: `${deduplicationKey}:user:${userId}`,
      })
    )
  );
};