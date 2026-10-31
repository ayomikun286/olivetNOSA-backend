import Obligation from "../models/Obligation.js";
import ObligationAssignment from "../models/ObligationAssignment.js";

import {
  assignIndividualObligationToMembers,
  assignCollectiveObligationToGroups,

} from "../services/obligationAssignmentService.js";

import YearSet from "../models/YearSet.js";
import Chapter from "../models/Chapter.js";
import { createAuditLog } from "../services/auditLog.service.js";
import { createNotification } from "../services/notificationService.js";
import { processObligationReminders } from "../services/obligationReminder.service.js";
import { processMembershipSuspensions } from "../services/membershipStatus.service.js";
import { sendEmail } from "../services/email.service.js";



// mail template helper // 


const escapeHtml = (value = "") =>
  String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[char]);

const buildObligationEmail = ({
  firstName,
  obligation,
  frontendUrl,
  groupName,
}) => {
  const obligationLink = `${frontendUrl}/portal/member/dashboard/my-obligation`;

  const amount = Number(obligation.amount).toLocaleString("en-NG");

  const dueDate = obligation.dueDate
    ? new Date(obligation.dueDate).toLocaleDateString("en-NG", {
      day: "numeric",
      month: "long",
      year: "numeric",
    })
    : "Not specified";

  return `
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>New Payment Obligation - OlivetNOSA</title>
  </head>

  <body style="margin:0;padding:0;background-color:#EAF1F8;font-family:Arial,Helvetica,sans-serif;color:#0B294D;">

    <table width="100%" cellpadding="0" cellspacing="0" border="0"
      style="background-color:#EAF1F8;padding:40px 15px;">
      <tr>
        <td align="center">

          <table width="100%" cellpadding="0" cellspacing="0" border="0"
            style="max-width:620px;background-color:#ffffff;border-radius:12px;overflow:hidden;">

            <!-- HEADER -->
            <tr>
              <td style="background-color:#0B294D;padding:30px 35px;text-align:center;">

                <img
                  src="https://res.cloudinary.com/bx4pnrek/image/upload/v1792582571/onw-gosa/website-content/ob1t3jspsuqz8wvxnkba.png"
                  alt="OlivetNOSA"
                  width="70"
                  style="display:block;margin:0 auto 15px;max-width:70px;"
                />

                <div style="color:#ffffff;font-size:22px;font-weight:bold;">
                  OlivetNOSA
                </div>

                <div style="color:#C9A227;font-size:11px;font-weight:bold;letter-spacing:2px;margin-top:7px;text-transform:uppercase;">
                  National Old Students' Association
                </div>

              </td>
            </tr>

            <!-- GOLD DIVIDER -->
            <tr>
              <td style="height:4px;background-color:#C9A227;font-size:0;line-height:0;">
                &nbsp;
              </td>
            </tr>

            <!-- CONTENT -->
            <tr>
              <td style="padding:40px 35px;">

                <p style="margin:0 0 8px;color:#C9A227;font-size:12px;font-weight:bold;letter-spacing:1.5px;text-transform:uppercase;">
                  Payment Notification
                </p>

                <h1 style="margin:0 0 20px;color:#0B294D;font-size:28px;line-height:1.25;">
                  New payment obligation
                </h1>

                <p style="margin:0 0 18px;color:#4B6075;font-size:15px;line-height:1.7;">
                  Hello ${escapeHtml(firstName)},
                </p>

                <p style="margin:0 0 25px;color:#4B6075;font-size:15px;line-height:1.7;">
                  A new payment obligation has been added to your OlivetNOSA account.
                  Please review the details below.
                </p>

                <!-- OBLIGATION DETAILS -->
                <table width="100%" cellpadding="0" cellspacing="0" border="0"
                  style="background-color:#EAF1F8;border-radius:8px;padding:20px;">

                  <tr>
                    <td colspan="2" style="padding-bottom:15px;">
                      <h2 style="margin:0;color:#123B6D;font-size:19px;">
                        ${escapeHtml(obligation.name)}
                      </h2>
                    </td>
                  </tr>

                  ${groupName ? `
                  <tr>
                    <td style="padding:8px 0;color:#4B6075;font-size:14px;">Group</td>
                    <td align="right" style="padding:8px 0;color:#0B294D;font-size:14px;font-weight:bold;">
                      ${escapeHtml(groupName)}
                    </td>
                  </tr>
                  ` : ""}

                  <tr>
                    <td style="padding:8px 0;color:#4B6075;font-size:14px;">Amount</td>
                    <td align="right" style="padding:8px 0;color:#123B6D;font-size:17px;font-weight:bold;">
                      ₦${amount}
                    </td>
                  </tr>

                  <tr>
                    <td style="padding:8px 0;color:#4B6075;font-size:14px;">Obligation Year</td>
                    <td align="right" style="padding:8px 0;color:#0B294D;font-size:14px;font-weight:bold;">
                      ${escapeHtml(obligation.year)}
                    </td>
                  </tr>

                  <tr>
                    <td style="padding:8px 0;color:#4B6075;font-size:14px;">Due Date</td>
                    <td align="right" style="padding:8px 0;color:#0B294D;font-size:14px;font-weight:bold;">
                      ${dueDate}
                    </td>
                  </tr>

                  ${obligation.description ? `
                  <tr>
                    <td colspan="2" style="padding-top:15px;border-top:1px solid #D5E0EA;color:#4B6075;font-size:13px;line-height:1.7;">
                      ${escapeHtml(obligation.description)}
                    </td>
                  </tr>
                  ` : ""}

                </table>

                <p style="margin:28px 0;color:#4B6075;font-size:15px;line-height:1.7;">
                  Please log in to your member portal to review the obligation and check your payment status.
                </p>

                <!-- CTA -->
                <table width="100%" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td align="center">
                      <a href="${obligationLink}"
                        style="display:inline-block;background-color:#123B6D;color:#ffffff;text-decoration:none;font-size:14px;font-weight:bold;padding:15px 30px;border-radius:7px;">
                        View My Obligation
                      </a>
                    </td>
                  </tr>
                </table>

                <!-- FALLBACK LINK -->
                <p style="margin:30px 0 8px;color:#4B6075;font-size:13px;line-height:1.6;">
                  If the button above does not work, copy and paste this link into your browser:
                </p>

                <p style="margin:0;word-break:break-all;font-size:12px;line-height:1.6;">
                  <a href="${obligationLink}" style="color:#123B6D;text-decoration:underline;">
                    ${obligationLink}
                  </a>
                </p>

                <p style="margin:30px 0 0;padding-top:25px;border-top:1px solid #E5EAF0;color:#6B7C8F;font-size:12px;line-height:1.6;">
                  If you have already fulfilled this obligation, please check your payment history or contact the association's administration for assistance.
                </p>

              </td>
            </tr>

            <!-- FOOTER -->
            <tr>
              <td style="background-color:#0B294D;padding:25px 35px;text-align:center;">

                <p style="margin:0;color:#ffffff;font-size:13px;font-weight:bold;">
                  OlivetNOSA
                </p>

                <p style="margin:7px 0 0;color:rgba(255,255,255,0.65);font-size:11px;line-height:1.6;">
                  National Old Students' Association
                  <br />
                  Olivet Baptist High School
                </p>

                <p style="margin:15px 0 0;color:#C9A227;font-size:10px;letter-spacing:1px;">
                  CUM CHRISTO PROGREDERE
                </p>

              </td>
            </tr>

          </table>

          <p style="margin:20px 0 0;color:#7A8A9A;font-size:10px;text-align:center;">
            This is an automated email from OlivetNOSA. Please do not reply directly to this message.
          </p>

        </td>
      </tr>
    </table>

  </body>
  </html>
  `;
};



// CREATE OBLIGATION
export const createObligation = async (req, res) => {
  try {
    const {
      name,
      description,
      category,
      amount,
      paymentPlans,
      year,
      dueDate,
      isOptional,
    } = req.body;
    // VALIDATION
    if (!name || !category || amount === undefined || !year) {
      return res.status(400).json({
        success: false,
        message: "Name, category, amount and year are required.",
      });
    }

    if (amount < 0) {
      return res.status(400).json({
        success: false,
        message: "Amount cannot be negative.",
      });
    }

    if (paymentPlans?.length) {
      for (const plan of paymentPlans) {
        if (!plan.frequency || plan.amount === undefined) {
          return res.status(400).json({
            success: false,
            message:
              "Each payment plan must have a frequency and amount.",
          });
        }

        if (plan.amount < 0) {
          return res.status(400).json({
            success: false,
            message: "Payment plan amount cannot be negative.",
          });
        }
      }
    }

    // CREATE OBLIGATION
    const obligation = await Obligation.create({
      name,
      description,
      category,
      amount,
      paymentPlans: paymentPlans || [],
      year,
      dueDate: dueDate || null,
      isOptional: isOptional === true,
      createdBy: req.user._id,
    });

    // ASSIGN OBLIGATION TO THE APPROPRIATE RECIPIENTS
    let obligationsAssigned = 0;

    if (category === "individual") {
      const result = await assignIndividualObligationToMembers(
        obligation._id,
        req.user._id
      );

      obligationsAssigned = result.assigned;
    } else if (category === "yearSet" || category === "chapter") {
      const result = await assignCollectiveObligationToGroups(
        obligation._id,
        req.user._id
      );

      obligationsAssigned = result.assigned;
    }

   // ========================================
// NOTIFY THE APPROPRIATE RECIPIENTS
// ========================================

try {
  const emailPromises = [];

  if (category === "individual") {
    const assignments = await ObligationAssignment.find({
      obligation: obligation._id,
      user: { $exists: true, $ne: null },
    })
      .populate("user", "firstName lastName email")
      .select("user");

    // ------------------------------------
    // IN-APP NOTIFICATIONS
    // ------------------------------------

    await Promise.allSettled(
      assignments
        .filter((assignment) => assignment.user?._id)
        .map((assignment) =>
          createNotification({
            userId: assignment.user._id,
            type: "obligation",
            title: "New Payment Obligation",
            message: `A new payment obligation, ${obligation.name}, of ₦${Number(
              obligation.amount
            ).toLocaleString()} has been added to your account. Please review the obligation details.`,
            link: "/portal/member/dashboard/my-obligation",
          })
        )
    );

    // ------------------------------------
    // EMAIL NOTIFICATIONS
    // ------------------------------------

  const emailedUsers = new Set();

for (const assignment of assignments) {
  const recipient = assignment.user;

  if (!recipient?.email || !recipient?._id) continue;

  const userId = recipient._id.toString();

  if (emailedUsers.has(userId)) continue;

  emailedUsers.add(userId);

  emailPromises.push(
    sendEmail({
      to: recipient.email,
      subject: "New Payment Obligation - OlivetNOSA",
      html: buildObligationEmail({
        firstName: recipient.firstName,
        obligation,
      }),
    })
  );
}
  } else if (category === "yearSet" || category === "chapter") {
    const ownerField = category === "yearSet" ? "yearSet" : "chapter";

    const GroupModel = category === "yearSet" ? YearSet : Chapter;

    const assignments = await ObligationAssignment.find({
      obligation: obligation._id,
      [ownerField]: { $exists: true, $ne: null },
    })
      .select(ownerField)
      .lean();

    const groupIds = [
      ...new Set(
        assignments
          .map((assignment) => assignment[ownerField]?.toString())
          .filter(Boolean)
      ),
    ];

    const groups = await GroupModel.find({
      _id: { $in: groupIds },
      isActive: true,
      leader: { $exists: true, $ne: null },
    })
      .populate("leader", "firstName lastName email")
      .select("name year leader")
      .lean();

    // ------------------------------------
    // GET UNIQUE GROUP LEADERS
    // ------------------------------------

    const uniqueLeaders = new Map();

    for (const group of groups) {
      const leader = group.leader;

      if (!leader?._id) continue;

      uniqueLeaders.set(leader._id.toString(), {
        recipient: leader,
        groupName: group.name || group.year || "Your group",
      });
    }

    // ------------------------------------
    // IN-APP NOTIFICATIONS
    // ------------------------------------

    await Promise.allSettled(
      [...uniqueLeaders.keys()].map((userId) =>
        createNotification({
          userId,
          type: "obligation",
          title: "New Payment Obligation",
          message: `A new ${
            category === "yearSet" ? "Year Set" : "Chapter"
          } payment obligation, ${obligation.name}, of ₦${Number(
            obligation.amount
          ).toLocaleString()} has been added. Please review your group's obligation details.`,
          link: "/portal/member/dashboard/my-obligation",
        })
      )
    );

    // ------------------------------------
    // EMAIL NOTIFICATIONS
    // ------------------------------------

    for (const { recipient, groupName } of uniqueLeaders.values()) {
      if (!recipient?.email) continue;

      emailPromises.push(
        sendEmail({
          to: recipient.email,
          subject: "New Group Payment Obligation - OlivetNOSA",
          html: buildObligationEmail({
            firstName: recipient.firstName,
            obligation,
            groupName,
          }),
        })
      );
    }
  }

  // ------------------------------------
  // SEND EMAILS WITHOUT BLOCKING CREATION
  // ------------------------------------

  const emailResults = await Promise.allSettled(emailPromises);

  const failedEmails = emailResults.filter(
    (result) => result.status === "rejected"
  );

  if (failedEmails.length > 0) {
    console.error(
      `${failedEmails.length} obligation email(s) failed:`,
      failedEmails.map((result) => result.reason)
    );
  }
} catch (notificationError) {
  console.error(
    "Obligation creation notification error:",
    notificationError
  );
}
    // ========================================
    // AUDIT LOG
    // ========================================

    await createAuditLog({
      actor: req.user._id,
      action: "obligation.created",
      resource: "Obligation",
      resourceId: obligation._id,
      details: {
        name: obligation.name,
        description: obligation.description,
        category: obligation.category,
        amount: obligation.amount,
        paymentPlans: obligation.paymentPlans,
        year: obligation.year,
        dueDate: obligation.dueDate,
        obligationsAssigned,
      },
      req,
    });

    return res.status(201).json({
      success: true,
      message: "Obligation created successfully.",
      obligation,
      obligationsAssigned,
    });
  } catch (error) {
    console.error("Create obligation error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to create obligation.",
    });
  }
};


// GET ALL OBLIGATIONS
export const getObligations = async (req, res) => {
  try {
    const { category, year, isActive } = req.query;

    const filter = {};

    if (category) filter.category = category;
    if (year) filter.year = Number(year);
    if (isActive !== undefined) {
      filter.isActive = isActive === "true";
    }

    const obligations = await Obligation.find(filter)
      .populate("createdBy", "firstName lastName email")
      .sort({ year: -1, createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: obligations.length,
      obligations,
    });
  } catch (error) {
    console.error("Get obligations error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch obligations.",
    });
  }
};



// get single obligation 
export const getObligation = async (req, res) => {
  try {
    const { id } = req.params;

    const obligation = await Obligation.findById(id).populate(
      "createdBy",
      "firstName lastName email"
    );

    if (!obligation) {
      return res.status(404).json({
        success: false,
        message: "Obligation not found.",
      });
    }

    return res.status(200).json({
      success: true,
      obligation,
    });
  } catch (error) {
    console.error("Get obligation error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch obligation.",
    });
  }
};



export const updateObligation = async (req, res) => {
  try {
    const { id } = req.params;

    const allowedFields = [
      "name",
      "description",
      "category",
      "amount",
      "paymentPlans",
      "year",
      "dueDate",
      "isOptional",
    ];

    const updates = {};

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    }

    // ========================================
    // VALIDATE UPDATE FIELDS
    // ========================================

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        success: false,
        message: "No valid fields were provided for update.",
      });
    }

    // ========================================
    // VALIDATE AMOUNT
    // ========================================

    if (
      updates.amount !== undefined &&
      updates.amount < 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Amount cannot be negative.",
      });
    }

    // ========================================
    // VALIDATE PAYMENT PLANS
    // ========================================

    if (updates.paymentPlans?.length) {
      for (const plan of updates.paymentPlans) {
        if (
          !plan.frequency ||
          plan.amount === undefined
        ) {
          return res.status(400).json({
            success: false,
            message:
              "Each payment plan must have a frequency and amount.",
          });
        }

        if (plan.amount < 0) {
          return res.status(400).json({
            success: false,
            message:
              "Payment plan amount cannot be negative.",
          });
        }
      }
    }

    // ========================================
    // FIND OBLIGATION
    // ========================================

    const obligation = await Obligation.findById(id);

    if (!obligation) {
      return res.status(404).json({
        success: false,
        message: "Obligation not found.",
      });
    }

    // ========================================
    // CAPTURE BEFORE STATE FOR AUDIT
    // ========================================

    const before = {
      name: obligation.name,
      description: obligation.description,
      category: obligation.category,
      amount: obligation.amount,
      paymentPlans: obligation.paymentPlans,
      year: obligation.year,
      dueDate: obligation.dueDate,
      isOptional: obligation.isOptional,
      isActive: obligation.isActive,
    };

    // ========================================
    // UPDATE OBLIGATION
    // ========================================

    Object.assign(obligation, updates);

    await obligation.save();

    // ========================================
    // SYNC ASSIGNMENT DUE DATES
    // ========================================
    // If the obligation due date changes,
    // update the due date on all existing
    // member assignments for this obligation.

    if (updates.dueDate !== undefined) {
      await ObligationAssignment.updateMany(
        {
          obligation: obligation._id,
        },
        {
          $set: {
            dueDate: obligation.dueDate,
          },
        }
      );
    }

    // ========================================
    // NOTIFY ASSIGNED MEMBERS
    // ========================================

    if (Object.keys(updates).length > 0) {
      try {
        const assignments = await ObligationAssignment.find({
          obligation: obligation._id,
        }).select("user");

        if (assignments.length > 0) {
          await Promise.all(
            assignments.map((assignment) =>
              createNotification({
                userId: assignment.user,
                type: "obligation",
                title: "Payment Obligation Updated",
                message: `The ${obligation.name} payment obligation has been updated. Please review the latest obligation details.`,
                link: "/portal/member/dashboard/my-obligation",
              })
            )
          );
        }
      } catch (notificationError) {
        console.error(
          "Obligation update notification error:",
          notificationError
        );
      }
    }

    // ========================================
    // AUDIT LOG
    // ========================================

    await createAuditLog({
      actor: req.user._id,
      action: "obligation.updated",
      resource: "Obligation",
      resourceId: obligation._id,
      details: {
        before,
        after: {
          name: obligation.name,
          description: obligation.description,
          category: obligation.category,
          amount: obligation.amount,
          paymentPlans: obligation.paymentPlans,
          year: obligation.year,
          dueDate: obligation.dueDate,
          isOptional: obligation.isOptional,
          isActive: obligation.isActive,
        },
      },
      req,
    });

    // ========================================
    // RESPONSE
    // ========================================

    return res.status(200).json({
      success: true,
      message: "Obligation updated successfully.",
      obligation,
    });
  } catch (error) {
    console.error("Update obligation error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update obligation.",
    });
  }
};



export const toggleObligationStatus = async (req, res) => {
  try {
    const { id } = req.params;

    const obligation = await Obligation.findById(id);

    if (!obligation) {
      return res.status(404).json({
        success: false,
        message: "Obligation not found.",
      });
    }

    const previousStatus = obligation.isActive;

    obligation.isActive = !obligation.isActive;

    await obligation.save();

    // AUDIT STATUS CHANGE
    await createAuditLog({
      actor: req.user._id,
      action: obligation.isActive
        ? "obligation.activated"
        : "obligation.deactivated",
      resource: "Obligation",
      resourceId: obligation._id,
      req,
      details: {
        name: obligation.name,
        previousStatus,
        newStatus: obligation.isActive,
      },
    });


    // NOTIFY ASSIGNED MEMBERS AND GROUP LEADERS
    try {
      const ownerField =
        obligation.category === "yearSet"
          ? "yearSet"
          : obligation.category === "chapter"
            ? "chapter"
            : null;

      const title = obligation.isActive
        ? "Payment Obligation Activated"
        : "Payment Obligation Deactivated";

      const message = obligation.isActive
        ? `The ${obligation.name} payment obligation is now active. Please review your obligation details.`
        : `The ${obligation.name} payment obligation has been deactivated. Please review your obligation details for the latest status.`;

      if (!ownerField) {
        // Individual obligation: notify assigned members.
        const assignments = await ObligationAssignment.find({
          obligation: obligation._id,
          user: { $exists: true, $ne: null },
        }).select("user");

        const userIds = [
          ...new Set(
            assignments
              .map((assignment) => assignment.user?.toString())
              .filter(Boolean)
          ),
        ];

        await Promise.all(
          userIds.map((userId) =>
            createNotification({
              userId,
              type: "obligation",
              title,
              message,
              link: "/portal/member/dashboard/my-obligation",
            })
          )
        );
      } else {
        // Collective obligation: notify current group leaders.
        const GroupModel =
          ownerField === "yearSet" ? YearSet : Chapter;

        const assignments = await ObligationAssignment.find({
          obligation: obligation._id,
          [ownerField]: { $exists: true, $ne: null },
        })
          .select(ownerField)
          .lean();

        const groupIds = [
          ...new Set(
            assignments
              .map((assignment) => assignment[ownerField]?.toString())
              .filter(Boolean)
          ),
        ];

        const groups = await GroupModel.find({
          _id: { $in: groupIds },
          isActive: true,
          leader: { $exists: true, $ne: null },
        })
          .select("leader")
          .lean();

        const leaderIds = [
          ...new Set(
            groups
              .map((group) => group.leader?.toString())
              .filter(Boolean)
          ),
        ];

        await Promise.all(
          leaderIds.map((userId) =>
            createNotification({
              userId,
              type: "obligation",
              title,
              message,
              link: "/portal/member/dashboard/my-obligation",
            })
          )
        );
      }
    } catch (notificationError) {
      console.error(
        "Obligation status notification error:",
        notificationError
      );
    }

    return res.status(200).json({
      success: true,
      message: obligation.isActive
        ? "Obligation activated successfully."
        : "Obligation deactivated successfully.",
      obligation,
    });
  } catch (error) {
    console.error("Toggle obligation status error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update obligation status.",
    });
  }
};






export const runDailyMembershipJob = async (req, res) => {
  try {
    const secret = req.headers["x-internal-secret"];

    if (
      !secret ||
      !process.env.INTERNAL_PAYMENT_SECRET ||
      secret !== process.env.INTERNAL_PAYMENT_SECRET
    ) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized.",
      });
    }

    const reminderResult = await processObligationReminders();
    const suspensionResult = await processMembershipSuspensions();

    await createAuditLog({
      actor: null,
      action: "membership.daily_job_completed",
      resource: "MembershipJob",
      req,
      details: {
        reminders: reminderResult,
        suspensions: suspensionResult,
        completedAt: new Date(),
      },
    });

    return res.status(200).json({
      success: true,
      reminders: reminderResult,
      suspensions: suspensionResult,
    });
  } catch (error) {
    console.error("Daily membership job error:", error);

    return res.status(500).json({
      success: false,
      message: "Daily membership job failed.",
    });
  }
};