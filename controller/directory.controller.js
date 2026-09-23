import User from "../models/User.js";

export const getDirectoryMembers = async (req, res) => {
  try {
    const members = await User.find({
      status: "active",
      "profile.privacy.appearInDirectory": true,
    })
      .select(
        "firstName middleName lastName alumniId email phone enrollmentYear graduationYear chapter yearSet profile"
      )
      .populate("chapter", "_id name code country")
      .populate("yearSet", "_id year name")
      .sort({ lastName: 1, firstName: 1 });

    const directoryMembers = members.map((member) => {
      const profile = member.profile || {};
      const privacy = profile.privacy || {};

      return {
        id: member._id,
        firstName: member.firstName,
        middleName: member.middleName,
        lastName: member.lastName,

        alumniId: member.alumniId,

        enrollmentYear: member.enrollmentYear,
        graduationYear: member.graduationYear,

        chapter: member.chapter,
        yearSet: member.yearSet,

        profile: {
          olivetName: profile.olivetName,
          preferredName: profile.preferredName,
          profilePhoto: profile.profilePhoto,

          schoolHouse: profile.schoolHouse,
          studentType: profile.studentType,
          admissionNumber: profile.admissionNumber,

          nickname: profile.nickname,
          leadershipPosition: profile.leadershipPosition,
          clubsAndSocieties: profile.clubsAndSocieties,
          sportsAndActivities: profile.sportsAndActivities,
          awardsAndHonours: profile.awardsAndHonours,
          memorableTeachers: profile.memorableTeachers,
          olivetMemory: profile.olivetMemory,

          country: privacy.showLocation
            ? profile.country
            : undefined,

          city: privacy.showLocation
            ? profile.city
            : undefined,

          stateOfOrigin: privacy.showLocation
            ? profile.stateOfOrigin
            : undefined,

          professionalHeadline: profile.professionalHeadline,
          employmentStatus: profile.employmentStatus,
          jobTitle: profile.jobTitle,
          employer: privacy.showEmployer
            ? profile.employer
            : undefined,
          industry: profile.industry,
          profession: profile.profession,
          skills: profile.skills,

          businessOwner: privacy.showBusiness
            ? profile.businessOwner
            : undefined,
          businessName: privacy.showBusiness
            ? profile.businessName
            : undefined,
          businessServices: privacy.showBusiness
            ? profile.businessServices
            : undefined,

          otherEducation: profile.otherEducation,
          qualifications: profile.qualifications,
          professionalMemberships: profile.professionalMemberships,
          achievements: profile.achievements,
          website: profile.website,

          whatsapp: privacy.showWhatsapp
            ? profile.whatsapp
            : undefined,

          socialLinks: privacy.showSocialLinks
            ? profile.socialLinks
            : undefined,
        },

        contact: {
          email: privacy.showEmail
            ? member.email
            : undefined,

          phone: privacy.showPhone
            ? member.phone
            : undefined,
        },
      };
    });

    return res.status(200).json({
      success: true,
      message: "Directory members retrieved successfully.",
      data: directoryMembers,
    });
  } catch (error) {
    console.error("Get directory members error:", error);

    return res.status(500).json({
      success: false,
      message: "Something went wrong while retrieving the directory.",
    });
  }
};