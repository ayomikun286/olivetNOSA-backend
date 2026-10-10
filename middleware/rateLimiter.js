import rateLimit from "express-rate-limit";

const createAuthLimiter = (max, message) =>
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      success: false,
      message,
    },
  });

export const loginLimiter = createAuthLimiter(
  10,
  "Too many login attempts. Try again in 15 minutes."
);

export const signupLimiter = createAuthLimiter(
  5,
  "Too many signup attempts. Try again in 15 minutes."
);

export const passwordResetLimiter = createAuthLimiter(
  5,
  "Too many password reset attempts. Try again in 15 minutes."
);

export const verificationLimiter = createAuthLimiter(
  5,
  "Too many verification attempts. Try again in 15 minutes."
);

export const serverLimiter = createAuthLimiter(
  10,
  "Too many requests. Try again in 15 minutes."
);