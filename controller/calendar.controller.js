import mongoose from "mongoose";

import CalendarEvent from "../models/CalendarEvent.js";

// ============================================================
// HELPER: VALID CATEGORIES
// ============================================================

const VALID_CATEGORIES = [
  "Meeting",
  "Seminar",
  "NEC",
  "AGM",
  "Event",
];

const VALID_LOCATIONS = [
  "Virtual",
  "Physical",
  "TBD",
];

const VALID_STATUSES = [
  "scheduled",
  "rescheduled",
  "cancelled",
];

// ============================================================
// HELPER: PARSE DATE
// ============================================================

const parseEventDate = (value) => {
  if (!value) return null;

  // Calendar dates are date-only values.
  // Store them at UTC midnight so the date never shifts
  // because of the server/user timezone.
  if (typeof value === "string") {
    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);

    if (match) {
      const [, year, month, day] = match;

      const parsedDate = new Date(
        Date.UTC(
          Number(year),
          Number(month) - 1,
          Number(day)
        )
      );

      if (Number.isNaN(parsedDate.getTime())) {
        return null;
      }

      return parsedDate;
    }
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
};








// ============================================================
// MEMBER: GET CALENDAR EVENTS
// ============================================================

export const getCalendarEvents = async (req, res) => {
  try {
    const {
      year,
      month,
      category,
      status,
    } = req.query;

    const filter = {};



    // ----------------------------------------
    // YEAR / MONTH FILTER
    // ----------------------------------------

    if (year !== undefined || month !== undefined) {
      const parsedYear =
        year !== undefined
          ? Number(year)
          : new Date().getUTCFullYear();

      if (
        Number.isNaN(parsedYear) ||
        parsedYear < 1900 ||
        parsedYear > 3000
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid year.",
        });
      }

      // Month supplied
      if (month !== undefined) {
        const parsedMonth = Number(month);

        if (
          Number.isNaN(parsedMonth) ||
          parsedMonth < 1 ||
          parsedMonth > 12
        ) {
          return res.status(400).json({
            success: false,
            message: "Month must be between 1 and 12.",
          });
        }

        filter.date = {
          $gte: new Date(
            Date.UTC(
              parsedYear,
              parsedMonth - 1,
              1
            )
          ),

          $lt: new Date(
            Date.UTC(
              parsedYear,
              parsedMonth,
              1
            )
          ),
        };
      }

      // Only year supplied
      else {
        filter.date = {
          $gte: new Date(
            Date.UTC(parsedYear, 0, 1)
          ),

          $lt: new Date(
            Date.UTC(parsedYear + 1, 0, 1)
          ),
        };
      }
    }

    // ----------------------------------------
    // CATEGORY FILTER
    // ----------------------------------------

    if (category?.trim()) {
      if (!VALID_CATEGORIES.includes(category)) {
        return res.status(400).json({
          success: false,
          message: "Invalid calendar category.",
        });
      }

      filter.category = category;
    }

    // ----------------------------------------
    // STATUS FILTER
    // ----------------------------------------

    if (status?.trim()) {
      if (!VALID_STATUSES.includes(status)) {
        return res.status(400).json({
          success: false,
          message: "Invalid calendar status.",
        });
      }

      filter.status = status;
    } else {
      // Members should not see cancelled events
      filter.status = {
        $ne: "cancelled",
      };
    }

    // ----------------------------------------
    // GET EVENTS
    // ----------------------------------------

    const events = await CalendarEvent.find(filter)
      .select(
        "title description date time host participants locationDetails location category status originalDate meetingPlatform meetingLink"
      )
      .sort({
        date: 1,
        createdAt: 1,
      });


      // console.log("Retrieved events:", events);

    return res.status(200).json({
      success: true,
      message:
        "Calendar events retrieved successfully.",
      data: events,
    });
  } catch (error) {
    console.error(
      "Get calendar events error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Something went wrong while retrieving calendar events.",
    });
  }
};

// ============================================================
// MEMBER: GET CALENDAR EVENT BY ID
// ============================================================

export const getCalendarEventById = async (
  req,
  res
) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid calendar event ID.",
      });
    }

    const event = await CalendarEvent.findOne({
      _id: id,
      status: {
        $ne: "cancelled",
      },
    }).select(
      "title description date time host participants locationDetails location category status originalDate meetingPlatform meetingLink"
    );

    if (!event) {
      return res.status(404).json({
        success: false,
        message: "Calendar event not found.",
      });
    }

    return res.status(200).json({
      success: true,
      message:
        "Calendar event retrieved successfully.",
      data: event,
    });
  } catch (error) {
    console.error(
      "Get calendar event error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Something went wrong while retrieving the calendar event.",
    });
  }
};

// ============================================================
// ADMIN: GET ALL CALENDAR EVENTS
// ============================================================

export const getAdminCalendarEvents = async (
  req,
  res
) => {
  try {
    const {
      year,
      month,
      category,
      status,
      search,
    } = req.query;

    const filter = {};

    // ----------------------------------------
    // YEAR / MONTH FILTER
    // ----------------------------------------

    if (year !== undefined || month !== undefined) {
      const parsedYear =
        year !== undefined
          ? Number(year)
          : new Date().getUTCFullYear();

      if (
        Number.isNaN(parsedYear) ||
        parsedYear < 1900 ||
        parsedYear > 3000
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid year.",
        });
      }

      // Month supplied
      if (month !== undefined) {
        const parsedMonth = Number(month);

        if (
          Number.isNaN(parsedMonth) ||
          parsedMonth < 1 ||
          parsedMonth > 12
        ) {
          return res.status(400).json({
            success: false,
            message: "Month must be between 1 and 12.",
          });
        }

        filter.date = {
          $gte: new Date(
            Date.UTC(
              parsedYear,
              parsedMonth - 1,
              1
            )
          ),

          $lt: new Date(
            Date.UTC(
              parsedYear,
              parsedMonth,
              1
            )
          ),
        };
      }

      // Only year supplied
      else {
        filter.date = {
          $gte: new Date(
            Date.UTC(parsedYear, 0, 1)
          ),

          $lt: new Date(
            Date.UTC(parsedYear + 1, 0, 1)
          ),
        };
      }
    }
    // ----------------------------------------
    // CATEGORY
    // ----------------------------------------

    if (category?.trim()) {
      if (!VALID_CATEGORIES.includes(category)) {
        return res.status(400).json({
          success: false,
          message: "Invalid calendar category.",
        });
      }

      filter.category = category;
    }

    // ----------------------------------------
    // STATUS
    // ----------------------------------------

    if (status?.trim()) {
      if (!VALID_STATUSES.includes(status)) {
        return res.status(400).json({
          success: false,
          message: "Invalid calendar status.",
        });
      }

      filter.status = status;
    }

    // ----------------------------------------
    // SEARCH
    // ----------------------------------------

    if (search?.trim()) {
      filter.$or = [
        {
          title: {
            $regex: search.trim(),
            $options: "i",
          },
        },
        {
          host: {
            $regex: search.trim(),
            $options: "i",
          },
        },
        {
          participants: {
            $regex: search.trim(),
            $options: "i",
          },
        },
      ];
    }

    // ----------------------------------------
    // GET EVENTS
    // ----------------------------------------

    const events = await CalendarEvent.find(filter)
      .sort({
        date: 1,
        createdAt: -1,
      })
      .populate(
        "createdBy",
        "firstName lastName email"
      )
      .populate(
        "updatedBy",
        "firstName lastName email"
      );

    return res.status(200).json({
      success: true,
      message:
        "Calendar events retrieved successfully.",
      data: events,
    });
  } catch (error) {
    console.error(
      "Get admin calendar events error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Something went wrong while retrieving calendar events.",
    });
  }
};

// ============================================================
// ADMIN: GET CALENDAR EVENT BY ID
// ============================================================

export const getAdminCalendarEventById = async (
  req,
  res
) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid calendar event ID.",
      });
    }

    const event = await CalendarEvent.findById(id)
      .populate(
        "createdBy",
        "firstName lastName email"
      )
      .populate(
        "updatedBy",
        "firstName lastName email"
      );

    if (!event) {
      return res.status(404).json({
        success: false,
        message: "Calendar event not found.",
      });
    }

    return res.status(200).json({
      success: true,
      message:
        "Calendar event retrieved successfully.",
      data: event,
    });
  } catch (error) {
    console.error(
      "Get admin calendar event error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Something went wrong while retrieving the calendar event.",
    });
  }
};

// ============================================================
// ADMIN: CREATE CALENDAR EVENT
// ============================================================

export const createCalendarEvent = async (req, res) => {
  try {
    const {
      title,
      description,
      date,
      time,
      host,
      participants,
      location,
      locationDetails,
      meetingPlatform,
      meetingLink,
      category,
      status,
    } = req.body;

    // ----------------------------------------
    // REQUIRED FIELDS
    // ----------------------------------------

    if (!title?.trim()) {
      return res.status(400).json({
        success: false,
        message: "Event title is required.",
      });
    }

    if (!date) {
      return res.status(400).json({
        success: false,
        message: "Event date is required.",
      });
    }

    // ----------------------------------------
    // DATE VALIDATION
    // ----------------------------------------

    const parsedDate = parseEventDate(date);

    if (!parsedDate) {
      return res.status(400).json({
        success: false,
        message: "Event date is invalid.",
      });
    }

    // ----------------------------------------
    // CATEGORY VALIDATION
    // ----------------------------------------

    const selectedCategory = category?.trim() || "Event";

    if (!VALID_CATEGORIES.includes(selectedCategory)) {
      return res.status(400).json({
        success: false,
        message: "Invalid calendar category.",
      });
    }

    // ----------------------------------------
    // LOCATION VALIDATION
    // ----------------------------------------

    const selectedLocation = location?.trim() || "TBD";

    if (!VALID_LOCATIONS.includes(selectedLocation)) {
      return res.status(400).json({
        success: false,
        message: "Invalid calendar location.",
      });
    }


    // ----------------------------------------
    // LOCATION DETAILS
    // ----------------------------------------

    const selectedLocationDetails = locationDetails?.trim() || "";
    const selectedMeetingPlatform = meetingPlatform?.trim() || ""
    const selectedMeetingLink = meetingLink?.trim() || "";

    const selectedStatus = status?.trim() || "scheduled";

    if (!VALID_STATUSES.includes(selectedStatus)) {
      return res.status(400).json({
        success: false,
        message: "Invalid calendar status.",
      });
    }



    if (selectedLocation === "Virtual" && !selectedMeetingLink) {
  return res.status(400).json({
    success: false,
    message: "Meeting link is required for virtual events.",
  });
}


if (selectedLocation === "Physical" && !selectedLocationDetails) {
  return res.status(400).json({
    success: false,
    message: "Location details are required for physical events.",
  });
}

    // ----------------------------------------
    // CREATE
    // ----------------------------------------

    const event = await CalendarEvent.create({
      title: title.trim(),

      description: description?.trim() || "",

      date: parsedDate,

      time: time?.trim() || "",

      host: host?.trim() || "",

      participants: participants?.trim() || "",

      location: selectedLocation,

      locationDetails: selectedLocationDetails,
      
      meetingPlatform: selectedMeetingPlatform,

      meetingLink: selectedMeetingLink,

      category: selectedCategory,

      status: selectedStatus,

      createdBy: req.user.id,
    });

    // ----------------------------------------
    // RESPONSE
    // ----------------------------------------

    return res.status(201).json({
      success: true,
      message: "Calendar event created successfully.",
      data: event,
    });
  } catch (error) {
    console.error("Create calendar event error:", error);

    return res.status(500).json({
      success: false,
      message:
        "Something went wrong while creating the calendar event.",
    });
  }
};

// ============================================================
// ADMIN: UPDATE CALENDAR EVENT
// ============================================================

export const updateCalendarEvent = async (req, res) => {
  try {
    const { id } = req.params;

    // ----------------------------------------
    // ID VALIDATION
    // ----------------------------------------

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid calendar event ID.",
      });
    }

    const event = await CalendarEvent.findById(id);

    if (!event) {
      return res.status(404).json({
        success: false,
        message: "Calendar event not found.",
      });
    }

    const {
      title,
      description,
      date,
      time,
      host,
      participants,
      location,
      locationDetails,
      meetingPlatform,
      meetingLink,
      category,
      status,
    } = req.body;

    // ----------------------------------------
    // TITLE
    // ----------------------------------------

    if (title !== undefined) {
      if (!title?.trim()) {
        return res.status(400).json({
          success: false,
          message: "Event title cannot be empty.",
        });
      }

      event.title = title.trim();
    }

    // ----------------------------------------
    // DESCRIPTION
    // ----------------------------------------

    if (description !== undefined) {
      event.description = description?.trim() || "";
    }

    // ----------------------------------------
    // DATE
    // ----------------------------------------

    if (date !== undefined) {
      const parsedDate = parseEventDate(date);

      if (!parsedDate) {
        return res.status(400).json({
          success: false,
          message: "Event date is invalid.",
        });
      }

      // Preserve original date only the first
      // time the event is rescheduled.
      if (
        event.date &&
        event.date.getTime() !== parsedDate.getTime() &&
        !event.originalDate
      ) {
        event.originalDate = event.date;
      }

      event.date = parsedDate;

      // Mark as rescheduled when the current date
      // differs from the original date.
      if (
        event.originalDate &&
        event.originalDate.getTime() !== parsedDate.getTime()
      ) {
        event.status = "rescheduled";
      }
    }

    // ----------------------------------------
    // TIME
    // ----------------------------------------

    if (time !== undefined) {
      event.time = time?.trim() || "";
    }

    // ----------------------------------------
    // HOST
    // ----------------------------------------

    if (host !== undefined) {
      event.host = host?.trim() || "";
    }

    // ----------------------------------------
    // PARTICIPANTS
    // ----------------------------------------

    if (participants !== undefined) {
      event.participants = participants?.trim() || "";
    }

    // ----------------------------------------
    // LOCATION
    // ----------------------------------------

    if (location !== undefined) {
      const selectedLocation = location?.trim() || "TBD";

      if (!VALID_LOCATIONS.includes(selectedLocation)) {
        return res.status(400).json({
          success: false,
          message: "Invalid calendar location.",
        });
      }

      event.location = selectedLocation;
    }

  if (meetingPlatform !== undefined) {
      event.meetingPlatform = meetingPlatform?.trim() || "";
    }

    if (meetingLink !== undefined) {
      event.meetingLink = meetingLink?.trim() || "";
    }



    // ----------------------------------------
    // LOCATION DETAILS
    // ----------------------------------------

    if (locationDetails !== undefined) {
      event.locationDetails =
        locationDetails?.trim() || "";
    }

    // ----------------------------------------
    // CATEGORY
    // ----------------------------------------

    if (category !== undefined) {
      const selectedCategory = category?.trim();

      if (!VALID_CATEGORIES.includes(selectedCategory)) {
        return res.status(400).json({
          success: false,
          message: "Invalid calendar category.",
        });
      }

      event.category = selectedCategory;
    }

    // ----------------------------------------
    // STATUS
    // ----------------------------------------

    if (status !== undefined) {
      const selectedStatus = status?.trim();

      if (!VALID_STATUSES.includes(selectedStatus)) {
        return res.status(400).json({
          success: false,
          message: "Invalid calendar status.",
        });
      }

      event.status = selectedStatus;
    }

    // ----------------------------------------
    // UPDATED BY
    // ----------------------------------------

    event.updatedBy = req.user.id;

    // ----------------------------------------
    // SAVE
    // ----------------------------------------

    await event.save();

    // ----------------------------------------
    // RESPONSE
    // ----------------------------------------

    return res.status(200).json({
      success: true,
      message: "Calendar event updated successfully.",
      data: event,
    });
  } catch (error) {
    console.error("Update calendar event error:", error);

    return res.status(500).json({
      success: false,
      message:
        "Something went wrong while updating the calendar event.",
    });
  }
};

// ============================================================
// ADMIN: DELETE CALENDAR EVENT
// ============================================================

export const deleteCalendarEvent = async (
  req,
  res
) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid calendar event ID.",
      });
    }

    const event =
      await CalendarEvent.findById(id);

    if (!event) {
      return res.status(404).json({
        success: false,
        message: "Calendar event not found.",
      });
    }

    await CalendarEvent.findByIdAndDelete(id);

    return res.status(200).json({
      success: true,
      message:
        "Calendar event deleted successfully.",
    });
  } catch (error) {
    console.error(
      "Delete calendar event error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Something went wrong while deleting the calendar event.",
    });
  }
};