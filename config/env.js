import dotenv from "dotenv";

dotenv.config();

const requiredEnvVars = [
  "JWT_SECRET",
  "SESSION_SECRET",
  "FRONTEND_URL",
];

console.log("PRODUCTION ENV CHECK:", {
  JWT_SECRET: Boolean(process.env.JWT_SECRET?.trim()),
  SESSION_SECRET: Boolean(process.env.SESSION_SECRET?.trim()),
  FRONTEND_URL: Boolean(process.env.FRONTEND_URL?.trim()),
});

const missingEnvVars = requiredEnvVars.filter(
  (key) => !process.env[key]?.trim()
);

if (missingEnvVars.length > 0) {
  throw new Error(
    `Missing required environment variables: ${missingEnvVars.join(", ")}`
  );
}