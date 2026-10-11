import Notification from "../models/Notification.js";


export const getMyNotifications = async (req, res) => {
  try {
    const userId = req.user._id;

    const notifications = await Notification.find({
      user: userId,
    })
      .sort({ createdAt: -1 })
      .limit(5)
      .lean();

    const unreadCount = await Notification.countDocuments({
      user: userId,
      isRead: false,
    });

    res.status(200).json({
      success: true,
      unreadCount,
      notifications,
    });
  } catch (error) {
    console.error("Get notifications error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to load notifications.",
    });
  }
};


export const getUnreadNotificationCount = async (req, res) => {
    try {
        const unreadCount = await Notification.countDocuments({
            user: req.user._id,
            isRead: false,
        });

        res.status(200).json({
            success: true,
            unreadCount,
        });
    } catch (error) {
        console.error("Get unread count error:", error);

        res.status(500).json({
            success: false,
            message: "Failed to get unread notification count.",
        });
    }
};


export const markNotificationAsRead = async (req, res) => {
    try {
        const notification = await Notification.findOneAndUpdate(
            {
                _id: req.params.id,
                user: req.user._id,
            },
            {
                isRead: true,
            },
            {
                new: true,
            }
        );

        if (!notification) {
            return res.status(404).json({
                success: false,
                message: "Notification not found.",
            });
        }

        res.status(200).json({
            success: true,
            notification,
        });
    } catch (error) {
        console.error("Mark notification read error:", error);

        res.status(500).json({
            success: false,
            message: "Failed to update notification.",
        });
    }
};



export const markAllNotificationsAsRead = async (req, res) => {
    try {
        await Notification.updateMany(
            {
                user: req.user._id,
                isRead: false,
            },
            {
                isRead: true,
            }
        );

        res.status(200).json({
            success: true,
            message: "All notifications marked as read.",
        });
    } catch (error) {
        console.error("Mark all notifications read error:", error);

        res.status(500).json({
            success: false,
            message: "Failed to update notifications.",
        });
    }
};



export const getAllMyNotifications = async (req, res) => {
  try {
    const userId = req.user._id;
    const { status = "all", page = 1, limit = 10 } = req.query;

    const currentPage = Math.max(1, Number(page) || 1);
    const pageSize = Math.min(50, Math.max(1, Number(limit) || 10));

    const filter = { user: userId };

    if (status === "unread") {
      filter.isRead = false;
    } else if (status === "read") {
      filter.isRead = true;
    }

    const [notifications, total, unreadCount] = await Promise.all([
      Notification.find(filter)
        .sort({ createdAt: -1 })
        .skip((currentPage - 1) * pageSize)
        .limit(pageSize)
        .lean(),

      Notification.countDocuments(filter),

      Notification.countDocuments({
        user: userId,
        isRead: false,
      }),
    ]);

    return res.status(200).json({
      success: true,
      notifications,
      unreadCount,
      pagination: {
        page: currentPage,
        limit: pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (error) {
    console.error("Get all notifications error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to load notifications.",
    });
  }
};