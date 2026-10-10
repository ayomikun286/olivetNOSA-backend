
export const requireFinancialMember = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      ok: false,
      message: "Authentication required.",
    });
  }

  if (req.user.financialStatus !== "financial") {
    return res.status(403).json({
      ok: false,
      message: "This feature is available to financial members only.",
    });
  }

  next();
};