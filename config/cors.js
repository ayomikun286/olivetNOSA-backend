export const corsOptions = {
  origin: ["http://localhost:5173", "https://olivetbhsnosa.org"],

  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],

  credentials: true,

  allowedHeaders: ["Content-Type", "Authorization"],
};