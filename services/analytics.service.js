
import AnalyticsEvent from "../models/AnalyticsEvent.js";

const ALLOWED_EVENT_TYPES = [
  "page_view",
  "button_click",
  "link_click",
];

const validationError = (message) => {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
};

export const recordAnalyticsEvent = async ({
  eventType,
  visitorId,
  sessionId = null,
  pagePath,
  elementLabel = null,
  targetPath = null,
} = {}) => {
  // Validate event type
  if (!ALLOWED_EVENT_TYPES.includes(eventType)) {
    throw validationError("Invalid analytics event type");
  }

  // Validate visitor identifier
  if (
    typeof visitorId !== "string" ||
    !visitorId.trim() ||
    visitorId.trim().length > 100
  ) {
    throw validationError("Invalid visitor identifier");
  }

  // Validate page path
  if (
    typeof pagePath !== "string" ||
    !pagePath.trim() ||
    pagePath.trim().length > 300 ||
    !pagePath.trim().startsWith("/") ||
    pagePath.trim().startsWith("//")
  ) {
    throw validationError("Invalid page path");
  }

  // Validate session ID when supplied
  if (
    sessionId !== null &&
    (typeof sessionId !== "string" ||
      !sessionId.trim() ||
      sessionId.trim().length > 100)
  ) {
    throw validationError("Invalid session identifier");
  }

  const isClickEvent = ["button_click", "link_click"].includes(eventType);

  // Click events must identify the clicked element
  if (
    isClickEvent &&
    (typeof elementLabel !== "string" || !elementLabel.trim())
  ) {
    throw validationError("Element label is required for click events");
  }

  // Validate element label when supplied
  if (
    elementLabel !== null &&
    (typeof elementLabel !== "string" ||
      elementLabel.trim().length > 150)
  ) {
    throw validationError("Invalid element label");
  }

  // Validate target path when supplied
  if (
    targetPath !== null &&
    (typeof targetPath !== "string" ||
      !targetPath.trim() ||
      targetPath.trim().length > 500)
  ) {
    throw validationError("Invalid target path");
  }

  // Target paths are only relevant to click events
  if (!isClickEvent && targetPath !== null) {
    throw validationError("Target path is only allowed for click events");
  }

  const analyticsEvent = new AnalyticsEvent({
    eventType,
    visitorId: visitorId.trim(),
    sessionId: sessionId?.trim() || null,
    pagePath: pagePath.trim(),
    elementLabel: elementLabel?.trim() || null,
    targetPath: targetPath?.trim() || null,
  });

  return analyticsEvent.save();
};








export const getAnalyticsDashboard = async ({
  startDate,
  endDate,
} = {}) => {
  const now = new Date();

  const end = endDate ? new Date(endDate) : now;

  const start = startDate
    ? new Date(startDate)
    : new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);

  // Include the entire selected end date
  if (endDate && /^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
    const selectedEndDate = new Date(endDate);

    // Reject dates that haven't started yet
    if (selectedEndDate > now) {
      const error = new Error("Invalid analytics date range");
      error.statusCode = 400;
      throw error;
    }

    end.setUTCHours(23, 59, 59, 999);

    // If the selected end date is today,
    // stop at the current time instead of the end of the day.
    if (end > now) {
      end.setTime(now.getTime());
    }
  }

  // Validate date range
  if (
    Number.isNaN(start.getTime()) ||
    Number.isNaN(end.getTime()) ||
    start > end ||
    end > now
  ) {
    const error = new Error("Invalid analytics date range");
    error.statusCode = 400;
    throw error;
  }

  // Prevent excessively large analytics queries
  const MAX_RANGE_DAYS = 366;

  const rangeInDays =
    (end.getTime() - start.getTime()) /
    (1000 * 60 * 60 * 24);

  if (rangeInDays > MAX_RANGE_DAYS) {
    const error = new Error(
      "Analytics date range cannot exceed 366 days"
    );
    error.statusCode = 400;
    throw error;
  }

  const match = {
    occurredAt: {
      $gte: start,
      $lte: end,
    },
  };

  // Keep the rest of your existing aggregation code below.
  const [
    overviewResult,
    uniqueVisitors,
    dailyVisitors,
    monthlyVisitors,
    topPages,
    topClicks,
  ] = await Promise.all([
    // 1. General statistics
    AnalyticsEvent.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,

          totalPageViews: {
            $sum: {
              $cond: [{ $eq: ["$eventType", "page_view"] }, 1, 0],
            },
          },

          totalClicks: {
            $sum: {
              $cond: [
                {
                  $in: ["$eventType", ["button_click", "link_click"]],
                },
                1,
                0,
              ],
            },
          },
        },
      },
    ]),

    // 2. Unique visitors
    AnalyticsEvent.distinct("visitorId", {
      ...match,
      eventType: "page_view",
    }),

    // 3. Daily unique visitors
    AnalyticsEvent.aggregate([
      {
        $match: {
          ...match,
          eventType: "page_view",
        },
      },
      {
        $group: {
          _id: {
            $dateToString: {
              format: "%Y-%m-%d",
              date: "$occurredAt",
              timezone: "Africa/Lagos",
            },
          },
          visitors: { $addToSet: "$visitorId" },
          pageViews: { $sum: 1 },
        },
      },
      {
        $project: {
          date: "$_id",
          uniqueVisitors: { $size: "$visitors" },
          pageViews: 1,
          _id: 0,
        },
      },
      { $sort: { date: 1 } },
    ]),

    // 4. Monthly unique visitors
    AnalyticsEvent.aggregate([
      {
        $match: {
          ...match,
          eventType: "page_view",
        },
      },
      {
        $group: {
          _id: {
            $dateToString: {
              format: "%Y-%m",
              date: "$occurredAt",
              timezone: "Africa/Lagos",
            },
          },
          visitors: { $addToSet: "$visitorId" },
          pageViews: { $sum: 1 },
        },
      },
      {
        $project: {
          month: "$_id",
          uniqueVisitors: { $size: "$visitors" },
          pageViews: 1,
          _id: 0,
        },
      },
      { $sort: { month: 1 } },
    ]),

    // 5. Most visited pages
    AnalyticsEvent.aggregate([
      {
        $match: {
          ...match,
          eventType: "page_view",
        },
      },
      {
        $group: {
          _id: "$pagePath",
          views: { $sum: 1 },
          visitors: { $addToSet: "$visitorId" },
        },
      },
      {
        $project: {
          pagePath: "$_id",
          views: 1,
          uniqueVisitors: { $size: "$visitors" },
          _id: 0,
        },
      },
      { $sort: { views: -1 } },
      { $limit: 10 },
    ]),

    // 6. Most clicked elements
    AnalyticsEvent.aggregate([
      {
        $match: {
          ...match,
          eventType: { $in: ["button_click", "link_click"] },
        },
      },
      {
        $group: {
          _id: {
            eventType: "$eventType",
            elementLabel: "$elementLabel",
            targetPath: "$targetPath",
          },
          clicks: { $sum: 1 },
        },
      },
      {
        $project: {
          eventType: "$_id.eventType",
          elementLabel: "$_id.elementLabel",
          targetPath: "$_id.targetPath",
          clicks: 1,
          _id: 0,
        },
      },
      { $sort: { clicks: -1 } },
      { $limit: 10 },
    ]),
  ]);

  const overview = overviewResult[0] || {
    totalPageViews: 0,
    totalClicks: 0,
  };

  return {
    overview: {
      ...overview,
      uniqueVisitors: uniqueVisitors.length,
    },
    dailyVisitors,
    monthlyVisitors,
    topPages,
    topClicks,
    dateRange: {
      startDate: start,
      endDate: end,
    },
  };
};
