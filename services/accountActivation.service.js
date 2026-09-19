import crypto from "crypto";
import User from "../models/User.js";

export const createAccountSetupToken = async (userId) => {
  const rawToken = crypto.randomBytes(32).toString("hex");

  const hashedToken = crypto
    .createHash("sha256")
    .update(rawToken)
    .digest("hex");

  const expires = new Date(Date.now() + 72 * 60 * 60 * 1000);

  await User.findByIdAndUpdate(userId, {
    accountSetupToken: hashedToken,
    accountSetupExpires: expires,
  });

  return rawToken;
};

export const verifyAccountSetupToken = async (token) => {
  if (!token) {
    return null;
  }

  const hashedToken = crypto
    .createHash("sha256")
    .update(token)
    .digest("hex");

  const user = await User.findOne({
    accountSetupToken: hashedToken,
    accountSetupExpires: { $gt: new Date() },
  }).select("+accountSetupToken +accountSetupExpires");

  return user;
};