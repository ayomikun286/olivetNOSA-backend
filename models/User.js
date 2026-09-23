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
    // MEMBER PROFILE
    // ========================================

    profile: {
      // Identity
      olivetName: {
        type: String,
        trim: true,
        maxlength: 100,
      },

      maidenName: {
        type: String,
        trim: true,
        maxlength: 100,
      },

      preferredName: {
        type: String,
        trim: true,
        maxlength: 100,
      },

      profilePhoto: {
        type: String,
        trim: true,
      },

      schoolHouse: {
        type: String,
        enum: [
          "Atanda",
          "Odetayo",
          "Locket",
          "Pinnock",
          "Homer Brown",
          "J.B.P. Lafinhan",
        ],
      },

      studentType: {
        type: String,
        enum: ["boarding", "day"],
      },

      admissionNumber: {
        type: String,
        trim: true,
        maxlength: 50,
      },

      whatsapp: {
        type: String,
        trim: true,
        maxlength: 30,
      },

      // Social Media
      socialLinks: {
        facebook: {
          type: String,
          trim: true,
        },
        instagram: {
          type: String,
          trim: true,
        },
        linkedin: {
          type: String,
          trim: true,
        },
      },

      // Olivet Experience
      nickname: {
        type: String,
        trim: true,
        maxlength: 50,
      },

      leadershipPosition: {
        type: String,
        trim: true,
        maxlength: 150,
      },

      clubsAndSocieties: {
        type: [String],
        default: [],
      },

      sportsAndActivities: {
        type: [String],
        default: [],
      },

      awardsAndHonours: {
        type: String,
        trim: true,
        maxlength: 1000,
      },

      memorableTeachers: {
        type: String,
        trim: true,
        maxlength: 500,
      },

      olivetMemory: {
        type: String,
        trim: true,
        maxlength: 1000,
      },

      // Location
      country: {
        type: String,
        trim: true,
        maxlength: 100,
      },

      city: {
        type: String,
        trim: true,
        maxlength: 100,
      },

      stateOfOrigin: {
        type: String,
        trim: true,
        maxlength: 100,
      },

      // Career
      professionalHeadline: {
        type: String,
        trim: true,
        maxlength: 150,
      },

      employmentStatus: {
        type: String,
        enum: [
          "employed",
          "self-employed",
          "business-owner",
          "student",
          "retired",
          "unemployed",
          "other",
        ],
      },

      jobTitle: {
        type: String,
        trim: true,
        maxlength: 150,
      },

      employer: {
        type: String,
        trim: true,
        maxlength: 150,
      },

      industry: {
        type: String,
        trim: true,
        maxlength: 100,
      },

      profession: {
        type: String,
        trim: true,
        maxlength: 150,
      },

      skills: {
        type: [String],
        default: [],
      },

      businessOwner: {
        type: Boolean,
        default: false,
      },

      businessName: {
        type: String,
        trim: true,
        maxlength: 150,
      },

      businessServices: {
        type: String,
        trim: true,
        maxlength: 500,
      },

      otherEducation: {
        type: String,
        trim: true,
        maxlength: 1000,
      },

      qualifications: {
        type: String,
        trim: true,
        maxlength: 1000,
      },

      professionalMemberships: {
        type: String,
        trim: true,
        maxlength: 500,
      },

      achievements: {
        type: String,
        trim: true,
        maxlength: 1000,
      },

      website: {
        type: String,
        trim: true,
      },

      // Directory Privacy
      privacy: {
        showEmail: {
          type: Boolean,
          default: false,
        },

        showPhone: {
          type: Boolean,
          default: false,
        },

        showWhatsapp: {
          type: Boolean,
          default: false,
        },

        showEmployer: {
          type: Boolean,
          default: true,
        },

        showLocation: {
          type: Boolean,
          default: true,
        },

        showSocialLinks: {
          type: Boolean,
          default: true,
        },

        showBusiness: {
          type: Boolean,
          default: true,
        },

        appearInDirectory: {
          type: Boolean,
          default: true,
        },
      },
    },


    // ========================================
    // AUTHENTICATION
    // ========================================

    password: {
      type: String,
      required: false,
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
    // ACCOUNT SETUP / ACTIVATION
    // ========================================
    accountSetupToken: {
      type: String,
      select: false,
    },

    accountSetupExpires: {
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
userSchema.index({ accountSetupToken: 1 });

const User = mongoose.model("User", userSchema);

export default User;