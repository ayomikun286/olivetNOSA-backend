import mongoose from "mongoose";
import SupportTicket from "../models/SupportTicket.js";
import User from "../models/User.js";
import { createNotification } from "./notificationService.js";

const ADMIN_ROLES = [
  "admin",
  "treasurer",
  "secretary",
  "superAdmin",
];

const createTicketNumber = () =>
  `GOSA-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

const getSenderRole = (user) => {
  if (user.role === "member") return "member";
  if (ADMIN_ROLES.includes(user.role)) return user.role;
  throw new Error("You are not authorized to use support.");
};

// MEMBER: CREATE A SUPPORT TICKET
export const createSupportTicket = async ({
  user,
  category,
  subject,
  message,
}) => {
  if (!user?._id || user.role !== "member") {
    throw new Error("Only members can create support tickets.");
  }

  const ticket = await SupportTicket.create({
    ticketNumber: createTicketNumber(),
    user: user._id,
    category,
    subject,
    messages: [
      {
        sender: user._id,
        senderRole: getSenderRole(user),
        message,
      },
    ],
    lastMessageAt: new Date(),
  });

  // Notify authorized support administrators.
  const admins = await User.find({
    role: { $in: ADMIN_ROLES },
    status: "active",
  })
    .select("_id")
    .lean();

  await Promise.all(
    admins.map((admin) =>
      createNotification({
        userId: admin._id,
        type: "system",
        title: "New support request",
        message: `A new support request has been submitted: ${subject}`,
        link: "/portal/admin/dashboard/support",
      })
    )
  );

  return ticket;
};

// MEMBER: LIST OWN SUPPORT TICKETS
export const getMySupportTickets = async (userId) => {
  return SupportTicket.find({ user: userId })
    .select("-messages")
    .sort({ updatedAt: -1 })
    .lean();
};

// MEMBER OR ADMIN: GET ONE TICKET
export const getSupportTicketById = async ({
  ticketId,
  user,
}) => {
  if (!mongoose.isValidObjectId(ticketId)) {
    throw new Error("Invalid support ticket ID.");
  }

  const ticket = await SupportTicket.findById(ticketId)
  .populate("user", "firstName middleName lastName alumniId email")
  .populate("assignedTo", "firstName middleName lastName email")
  .populate("messages.sender", "firstName middleName lastName email")
  .lean();

  if (!ticket) {
    throw new Error("Support ticket not found.");
  }

  const isAdmin = ADMIN_ROLES.includes(user.role);
  const ticketUserId = ticket.user?._id || ticket.user;

const isOwner = ticketUserId.toString() === user._id.toString();
  if (!isAdmin && !isOwner) {
    throw new Error("You are not authorized to view this ticket.");
  }

  return ticket;
};

// ADMIN: LIST ALL SUPPORT TICKETS
export const getAllSupportTickets = async ({
  status,
  category,
  search,
  page = 1,
  limit = 20,
}) => {
  const filter = {};

  if (status) filter.status = status;
  if (category) filter.category = category;

  if (search) {
    filter.$or = [
      { ticketNumber: { $regex: search, $options: "i" } },
      { subject: { $regex: search, $options: "i" } },
    ];
  }

  const safePage = Math.max(Number(page) || 1, 1);
  const safeLimit = Math.min(Math.max(Number(limit) || 20, 1), 100);

  const [tickets, total] = await Promise.all([
    SupportTicket.find(filter)
      .populate("user", "firstName middleName lastName alumniId email")
      .populate("assignedTo", "firstName lastName email")
      .select("-messages")
      .sort({ lastMessageAt: -1 })
      .skip((safePage - 1) * safeLimit)
      .limit(safeLimit)
      .lean(),
    SupportTicket.countDocuments(filter),
  ]);

  return {
    tickets,
    pagination: {
      page: safePage,
      limit: safeLimit,
      total,
      pages: Math.ceil(total / safeLimit),
    },
  };
};

// MEMBER OR ADMIN: REPLY TO A TICKET
export const replyToSupportTicket = async ({
  ticketId,
  user,
  message,
}) => {
  if (!mongoose.isValidObjectId(ticketId)) {
    throw new Error("Invalid support ticket ID.");
  }

  const senderRole = getSenderRole(user);
  const isAdmin = ADMIN_ROLES.includes(senderRole);

  const ticket = await SupportTicket.findById(ticketId);

  if (!ticket) {
    throw new Error("Support ticket not found.");
  }

  const isOwner = ticket.user.toString() === user._id.toString();

  if (!isAdmin && !isOwner) {
    throw new Error("You are not authorized to reply to this ticket.");
  }

  if (ticket.status === "closed") {
    throw new Error("This ticket is closed and cannot receive replies.");
  }

  if (ticket.status === "resolved" && !isAdmin) {
    throw new Error(
      "This ticket has been resolved. Contact support to reopen it."
    );
  }

  ticket.messages.push({
    sender: user._id,
    senderRole,
    message,
  });

  ticket.lastMessageAt = new Date();

  if (isAdmin) {
    ticket.assignedTo = user._id;

    if (ticket.status === "open") {
      ticket.status = "in_progress";
    }

    await createNotification({
      userId: ticket.user,
      type: "system",
      title: "Support replied",
      message: `An administrator replied to your request: ${ticket.subject}`,
      link: "/portal/member/dashboard/help-support",
    });

    
  } else {
  const admins = await User.find({
    role: { $in: ADMIN_ROLES },
    status: "active",
  })
    .select("_id")
    .lean();

  await Promise.all(
    admins.map((admin) =>
      createNotification({
        userId: admin._id,
        type: "system",
        title: "Member replied to support",
        message: `A member replied to: ${ticket.subject}`,
        link: "/portal/admin/dashboard/support",
      })
    )
  );
}

  await ticket.save();

  return ticket;
};





// ADMIN: UPDATE TICKET STATUS
export const updateSupportTicketStatus = async ({
  ticketId,
  status,
  assignedTo,
}) => {
  const allowedStatuses = [
    "open",
    "in_progress",
    "resolved",
    "closed",
  ];

  if (!mongoose.isValidObjectId(ticketId)) {
    throw new Error("Invalid support ticket ID.");
  }

  if (!allowedStatuses.includes(status)) {
    throw new Error("Invalid support ticket status.");
  }

  if (assignedTo && !mongoose.isValidObjectId(assignedTo)) {
    throw new Error("Invalid support assignee.");
  }

  if (assignedTo) {
    const assignee = await User.findOne({
      _id: assignedTo,
      role: { $in: ADMIN_ROLES },
      status: "active",
    }).select("_id");

    if (!assignee) {
      throw new Error("The selected assignee is not an active administrator.");
    }
  }

  const ticket = await SupportTicket.findById(ticketId);

  if (!ticket) {
    throw new Error("Support ticket not found.");
  }

  ticket.status = status;

  if (assignedTo !== undefined) {
    ticket.assignedTo = assignedTo || null;
  }

  ticket.resolvedAt =
    status === "resolved" || status === "closed"
      ? new Date()
      : null;

  await ticket.save();

  await createNotification({
    userId: ticket.user,
    type: "system",
    title: "Support request updated",
    message: `Your request "${ticket.subject}" is now ${status.replace("_", " ")}.`,
    link: "/portal/admin/dashboard/support",
  });

  return ticket;
};
