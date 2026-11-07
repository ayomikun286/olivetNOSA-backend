import { recordAnalyticsEvent, getAnalyticsDashboard  } from "../services/analytics.service.js";
import {getCountryFromIP} from "../utils/geoLocation.js";

export const trackAnalyticsEvent = async (req, res, next) => {
  try {
    const {
      eventType,
      visitorId,
      sessionId,
      pagePath,
      elementLabel,
      targetPath,
    } = req.body;

    // Get visitor's approximate country from their IP
    const location = getCountryFromIP(req.ip);

    const analyticsEvent = await recordAnalyticsEvent({
      eventType,
      visitorId,
      sessionId,
      pagePath,
      elementLabel,
      targetPath,
      country: location?.country || null,
      countryCode: location?.countryCode || null,
    });
 
   
    return res.status(201).json({
      success: true,
      message: "Analytics event recorded successfully",
      data: {
        id: analyticsEvent._id,
      },
    });
  } catch (error) {
    next(error);
  }
};








export const getAnalyticsDashboardData = async (req, res, next) => {
  
  try {
    const { startDate, endDate } = req.query;

    const analytics = await getAnalyticsDashboard({
      startDate,
      endDate,
    });

    return res.status(200).json({
      success: true,
      message: "Analytics dashboard data retrieved successfully",
      data: analytics,
    });
  } catch (error) {
    next(error);
  }
};