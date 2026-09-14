import { approveMember } from "../services/memberApproval.service.js";

export const approveMemberController = async (req, res) => {
  try {
    const { userId } = req.params;

    const result = await approveMember(userId);

    return res.status(200).json({
      success: true,
      message: "Member approved successfully.",
      data: {
        user: result.user,
        alumniId: result.alumniId,
        obligationsAssigned: result.obligationsAssigned,
      },
    });
  } catch (error) {
    console.error("Approve member error:", error);

    return res.status(400).json({
      success: false,
      message: error.message || "Failed to approve member.",
    });
  }
};