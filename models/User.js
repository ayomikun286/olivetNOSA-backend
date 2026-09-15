import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    // ========================================
    // IDENTITY
    // ========================================

    firstName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 50,
    },

    middleName: {
      type: String,
      trim: true,
      maxlength: 50,
    },

    lastName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 50,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: 150,
    },

    alumniId: {
      type: String,
      unique: true,
      sparse: true,
      uppercase: true,
      trim: true,
      maxlength: 50,
      
    },


    phone: {
      type: String,
      trim: true,
      maxlength: 30,
    },


    // ========================================
    // MEMBERSHIP INFORMATION
    // ========================================

    enrollmentYear: {
      type: Number,
      min: 1900,
    },

    graduationYear: {
      type: Number,
      min: 1900,
    },

    yearSet: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "YearSet",
      default: null,
    },

    chapter: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Chapter",
      default: null,
    },


    // ========================================
    // AUTHENTICATION
    // ========================================

    password: {
      type: String,
      required: true,
      select: false,
    },


    // ========================================
    // ACCOUNT STATUS & ROLE
    // ========================================

    role: {
      type: String,
      enum: [
        "member",
        "admin",
        "treasurer",
        "secretary",
        "superAdmin",
      ],
      default: "member",
    },

    status: {
      type: String,
      enum: ["pending", "active", "suspended", "inactive", "deactivated"],
      default: "pending",
    },


    // ========================================
    // EMAIL VERIFICATION
    // ========================================

    isEmailVerified: {
      type: Boolean,
      default: false,
    },

    emailVerificationToken: {
      type: String,
      select: false,
    },

    emailVerificationExpires: {
      type: Date,
      select: false,
    },


    


    // ========================================
    // PASSWORD RESET
    // ========================================

    passwordResetToken: {
      type: String,
      select: false,
    },

    passwordResetExpires: {
      type: Date,
      select: false,
    },


    


    // ========================================
    // LOGIN TRACKING
    // ========================================

    lastLogin: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);


// ========================================
// INDEXES
// ========================================

// Authentication / member lookup
// userSchema.index({ alumniId: 1 });

// Membership filtering
userSchema.index({ yearSet: 1 });
userSchema.index({ chapter: 1 });

// Admin filtering
userSchema.index({ status: 1 });
userSchema.index({ role: 1 });

// Verification / password reset
userSchema.index({ emailVerificationToken: 1 });
userSchema.index({ passwordResetToken: 1 });


const User = mongoose.model("User", userSchema);

export default User;