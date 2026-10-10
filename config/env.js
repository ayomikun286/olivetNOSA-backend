import dotenv from "dotenv";

dotenv.config();

const requiredEnvVars = [
  "JWT_SECRET",
  "SESSION_SECRET",
  "FRONTEND_URL",
];

const missingEnvVars = requiredEnvVars.filter(
  (key) => !process.env[key]?.trim()
);

if (missingEnvVars.length > 0) {
  throw new Error(
    `Missing required environment variables: ${missingEnvVars.join(", ")}`
  );
}