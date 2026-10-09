
import jwt from "jsonwebtoken";
import User from "../models/User.js";

const INACTIVITY_LIMIT = 5 * 60 * 1000;

export const protect = async (req, res, next) => {
  try {
    const token = req.cookies?.token;

    if (!token) {
      return res.status(401).json({
        ok: false,
        message: "Not authenticated.",
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const lastActivity = decoded.lastActivity ?? decoded.iat * 1000;

    if (
      !decoded.iat ||
      !lastActivity ||
      Date.now() - lastActivity >= INACTIVITY_LIMIT
    ) {
      res.clearCookie("token", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite:
          process.env.NODE_ENV === "production" ? "none" : "lax",
        path: "/",
      });

      return res.status(401).json({
        ok: false,
        code: "SESSION_INACTIVE",
        message: "Your session expired due to inactivity. Please log in again.",
      });
    }

    const user = await User.findById(decoded.id).select("-password");

    if (!user) {
      return res.status(401).json({
        ok: false,
        message: "User account not found.",
      });
    }

    if (!user.isEmailVerified) {
      return res.status(403).json({
        ok: false,
        message: "Please verify your email address.",
      });
    }

    req.user = user;
    next();
  } catch (error) {
    if (
      error.name === "TokenExpiredError" ||
      error.name === "JsonWebTokenError"
    ) {
      return res.status(401).json({
        ok: false,
        message: "Invalid or expired authentication.",
      });
    }

    console.error("Auth middleware error:", error);

    return res.status(500).json({
      ok: false,
      message: "Authentication check failed.",
    });
  }
};