export const corsOptions = {
  origin: "http://localhost:5173",

  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],

  credentials: true,

  allowedHeaders: ["Content-Type", "Authorization"],
};