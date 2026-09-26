import mongoose from "mongoose";

const calendarEventSchema = new mongoose.Schema(
  {
    // ========================================
    // BASIC INFORMATION
    // ========================================

    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },

    description: {
      type: String,
      trim: true,
      default: "",
      maxlength: 2000,
    },

    // ========================================
    // DATE & TIME
    // ========================================

    date: {
      type: Date,
      required: true,
    },

    time: {
      type: String,
      trim: true,
      default: "",
      maxlength: 50,
    },

    // ========================================
    // EVENT DETAILS
    // ========================================

    host: {
      type: String,
      trim: true,
      default: "",
      maxlength: 200,
    },

    participants: {
      type: String,
      trim: true,
      default: "",
      maxlength: 300,
    },

    location: {
      type: String,
      enum: ["Virtual", "Physical", "TBD"],
      default: "TBD",
    },

    // ========================================
    // CATEGORY
    // ========================================

    category: {
      type: String,
      enum: [
        "Meeting",
        "Seminar",
        "NEC",
        "AGM",
        "Event",
      ],
      default: "Event",
    },

    // ========================================
    // STATUS
    // ========================================

    status: {
      type: String,
      enum: [
        "scheduled",
        "rescheduled",
        "cancelled",
      ],
      default: "scheduled",
    },

    // ========================================
    // RESCHEDULE INFORMATION
    // ========================================

    originalDate: {
      type: Date,
      default: null,
    },

    // ========================================
    // AUTHOR
    // ========================================

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// ========================================
// INDEXES
// ========================================

calendarEventSchema.index({ date: 1 });

calendarEventSchema.index({
  category: 1,
});

calendarEventSchema.index({
  status: 1,
});

calendarEventSchema.index({
  createdAt: -1,
});

const CalendarEvent = mongoose.model(
  "CalendarEvent",
  calendarEventSchema
);

export default CalendarEvent;