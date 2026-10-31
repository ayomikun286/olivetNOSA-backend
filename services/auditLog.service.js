import AuditLog from "../models/AuditLog.js";

export const createAuditLog = async ({
  actor,
  action,
  resource,
  resourceId = null,
  targetUser = null,
  details = {},
  req = null,
  session = null,
}) => {
  const auditLog = new AuditLog({
    actor,
    action,
    resource,
    resourceId,
    targetUser,
    details,
    ipAddress:
      req?.ip ||
      req?.headers?.["x-forwarded-for"] ||
      null,
    userAgent: req?.headers?.["user-agent"] || null,
  });

  return auditLog.save(session ? { session } : {});
};