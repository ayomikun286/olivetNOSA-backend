import jwt from "jsonwebtoken";
import User from "../models/User.js";

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

    const user = await User.findById(decoded.id).select(
      "-password"
    );

    if (!user) {
      return res.status(401).json({
        ok: false,
        message: "User account not found.",
      });
    }

    // if (user.status !== "active") {
    //   return res.status(403).json({
    //     ok: false,
    //     message: "Your account is not active.",
    //   });
    // }

    if (!user.isEmailVerified) {
      return res.status(403).json({
        ok: false,
        message: "Please verify your email address.",
      });
    }

    req.user = user;

    next();
  } catch (error) {
    console.error("Auth middleware error:", error);

    return res.status(401).json({
      ok: false,
      message: "Invalid or expired authentication.",
    });
  }
};