import rateLimit from "express-rate-limit";

export const serverLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    standardHeaders:true,
    legacyHeaders:false,
    message:{
        success: false,
        message: "Too many attempts. Try again in 15 minutes."
    }
})
