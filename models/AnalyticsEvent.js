import mongoose from "mongoose";

const analyticsEventSchema = new mongoose.Schema(
  {
    // Type of activity being tracked
    eventType: {
      type: String,
      enum: [
        "page_view",
        "button_click",
        "link_click",
       
      ],
      required: true,
     
    },

    // Anonymous browser identifier
    visitorId: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },

    // Groups activities within a browsing session
    sessionId: {
      type: String,
      trim: true,
      maxlength: 100,
    },

    // Page where the activity happened
    pagePath: {
      type: String,
      required: true,
      trim: true,
      maxlength: 300,
    },

    // Button or link information
    elementLabel: {
      type: String,
      trim: true,
      maxlength: 150,
    },

    targetPath: {
      type: String,
      trim: true,
      maxlength: 500,
    },

    // Approximate visitor location derived from IP
country: {
  type: String,
  trim: true,
  default: null,
  maxlength: 100,
},

countryCode: {
  type: String,
  trim: true,
  uppercase: true,
  default: null,
  maxlength: 2,
},


    
  },
  {
    timestamps: {
      createdAt: "occurredAt",
      updatedAt: false,
    },
  }
);

// Analytics query indexes
analyticsEventSchema.index({ occurredAt: -1 });
analyticsEventSchema.index({ eventType: 1, occurredAt: -1 });
analyticsEventSchema.index({ visitorId: 1, occurredAt: -1 });
analyticsEventSchema.index({ pagePath: 1, occurredAt: -1 });

analyticsEventSchema.index({
  pagePath: 1,
  eventType: 1,
  occurredAt: -1,
});
const AnalyticsEvent = mongoose.model(
  "AnalyticsEvent",
  analyticsEventSchema
);

export default AnalyticsEvent;