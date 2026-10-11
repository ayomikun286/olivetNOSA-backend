import {
  successResponse,
  errorResponse,
} from "../utils/response.js";

import {
  createSupportTicket,
  getMySupportTickets,
  getSupportTicketById,
  getAllSupportTickets,
  replyToSupportTicket,
  updateSupportTicketStatus,
} from "../services/support.service.js";

const ADMIN_ROLES = [
  "admin",
  "treasurer",
  "secretary",
  "superAdmin",
];

const isAdmin = (user) => ADMIN_ROLES.includes(user?.role);

// MEMBER: CREATE TICKET
export const createSupportTicketController = async (req, res) => {
  try {
    const { category, subject, message } = req.body;

    if (!category || !subject?.trim() || !message?.trim()) {
      return errorResponse(
        res,
        400,
        "Category, subject, and message are required."
      );
    }

    const ticket = await createSupportTicket({
      user: req.user,
      category,
      subject,
      message,
    });

    return successResponse(
      res,
      "Support request submitted successfully.",
      ticket,
      201
    );
  } catch (error) {
    console.error("Create support ticket error:", error);

    return errorResponse(
      res,
      500,
      "Failed to submit support request."
    );
  }
};

// MEMBER: GET OWN TICKETS
export const getMySupportTicketsController = async (req, res) => {
  try {
    const tickets = await getMySupportTickets(req.user._id);

    return successResponse(
      res,
      "Support requests fetched successfully.",
      tickets
    );
  } catch (error) {
    console.error("Get member support tickets error:", error);

    return errorResponse(
      res,
      500,
      "Failed to fetch support requests."
    );
  }
};

// MEMBER OR ADMIN: GET ONE TICKET
export const getSupportTicketByIdController = async (req, res) => {
  try {
    const ticket = await getSupportTicketById({
      ticketId: req.params.id,
      user: req.user,
    });

    return successResponse(
      res,
      "Support request fetched successfully.",
      ticket
    );
  } catch (error) {
    console.error("Get support ticket error:", error);

    if (error.message === "Support ticket not found.") {
      return errorResponse(res, 404, error.message);
    }

    if (
      error.message.includes("authorized") ||
      error.message.includes("not authorized")
    ) {
      return errorResponse(res, 403, error.message);
    }

    if (error.message === "Invalid support ticket ID.") {
      return errorResponse(res, 400, error.message);
    }

    return errorResponse(
      res,
      500,
      "Failed to fetch support request."
    );
  }
};

// ADMIN: GET ALL TICKETS
export const getAllSupportTicketsController = async (req, res) => {
  try {
    if (!isAdmin(req.user)) {
      return errorResponse(res, 403, "Access denied.");
    }

    const result = await getAllSupportTickets({
      status: req.query.status,
      category: req.query.category,
      search: req.query.search,
      page: req.query.page,
      limit: req.query.limit,
    });

    return successResponse(
      res,
      "Support requests fetched successfully.",
      result
    );
  } catch (error) {
    console.error("Get all support tickets error:", error);

    return errorResponse(
      res,
      500,
      "Failed to fetch support requests."
    );
  }
};

// MEMBER OR ADMIN: REPLY
export const replyToSupportTicketController = async (req, res) => {
  try {
    const { message } = req.body;

    if (!message?.trim()) {
      return errorResponse(res, 400, "Message is required.");
    }

    const ticket = await replyToSupportTicket({
      ticketId: req.params.id,
      user: req.user,
      message,
    });

    return successResponse(
      res,
      "Reply sent successfully.",
      ticket
    );
  } catch (error) {
    console.error("Reply to support ticket error:", error);

    if (error.message === "Support ticket not found.") {
      return errorResponse(res, 404, error.message);
    }

    if (
      error.message.includes("authorized") ||
      error.message.includes("not authorized")
    ) {
      return errorResponse(res, 403, error.message);
    }

    if (
      error.message.includes("closed") ||
      error.message.includes("resolved")
    ) {
      return errorResponse(res, 400, error.message);
    }

    if (error.message === "Invalid support ticket ID.") {
      return errorResponse(res, 400, error.message);
    }

    return errorResponse(
      res,
      500,
      "Failed to send reply."
    );
  }
};

// ADMIN: UPDATE STATUS
export const updateSupportTicketStatusController = async (req, res) => {
  try {
    if (!isAdmin(req.user)) {
      return errorResponse(res, 403, "Access denied.");
    }

    const { status, assignedTo } = req.body;

    if (!status) {
      return errorResponse(res, 400, "Status is required.");
    }

    const ticket = await updateSupportTicketStatus({
      ticketId: req.params.id,
      status,
      assignedTo,
    });

    return successResponse(
      res,
      "Support request updated successfully.",
      ticket
    );
  } catch (error) {
    console.error("Update support ticket error:", error);

    if (error.message === "Support ticket not found.") {
      return errorResponse(res, 404, error.message);
    }

    if (
      error.message.includes("Invalid") ||
      error.message.includes("not an active administrator")
    ) {
      return errorResponse(res, 400, error.message);
    }

    return errorResponse(
      res,
      500,
      "Failed to update support request."
    );
  }
};