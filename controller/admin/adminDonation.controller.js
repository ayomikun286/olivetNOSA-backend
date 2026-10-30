import Donation from "../../models/Donation.js";

// GET /api/admin/donations
export const getAdminDonations = async (req, res) => {
    try {
        const {
            page = 1,
            limit = 10,
            search = "",
            status = "",
            gateway = "",
            startDate = "",
            endDate = "",
        } = req.query;

        const currentPage = Math.max(1, Number(page) || 1);
        const pageLimit = Math.min(100, Math.max(1, Number(limit) || 10));
        const skip = (currentPage - 1) * pageLimit;

        const filter = {};

        if (status) {
            filter.status = status;
        }

        if (gateway) {
            filter.gateway = gateway;
        }

        if (search.trim()) {
            const searchRegex = new RegExp(
                search.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
                "i"
            );

            filter.$or = [
                { donorName: searchRegex },
                { email: searchRegex },
                { gatewayReference: searchRegex },
            ];
        }

        if (startDate || endDate) {
            filter.createdAt = {};

            if (startDate) {
                const start = new Date(startDate);

                if (Number.isNaN(start.getTime())) {
                    return res.status(400).json({
                        success: false,
                        message: "Invalid start date.",
                    });
                }

                filter.createdAt.$gte = start;
            }

            if (endDate) {
                const end = new Date(endDate);

                if (Number.isNaN(end.getTime())) {
                    return res.status(400).json({
                        success: false,
                        message: "Invalid end date.",
                    });
                }

                end.setHours(23, 59, 59, 999);
                filter.createdAt.$lte = end;
            }
        }

        const [donations, total] = await Promise.all([
            Donation.find(filter)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(pageLimit)
                .select("-metadata")
                .populate("user", "firstName lastName email alumniId")
                .lean(),

            Donation.countDocuments(filter),
        ]);

        return res.status(200).json({
            success: true,
            donations,
            pagination: {
                currentPage,
                totalPages: Math.ceil(total / pageLimit),
                totalRecords: total,
                limit: pageLimit,
            },
        });

    } catch (error) {
        console.error("Get admin donations error:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to fetch donations.",
        });
    }
};


// GET /api/admin/donations/summary
export const getAdminDonationSummary = async (req, res) => {
    try {
        const summary = await Donation.aggregate([
            {
                $group: {
                    _id: null,

                    totalDonations: { $sum: 1 },

                    successfulDonations: {
                        $sum: {
                            $cond: [
                                { $eq: ["$status", "successful"] },
                                1,
                                0,
                            ],
                        },
                    },

                    pendingDonations: {
                        $sum: {
                            $cond: [
                                { $eq: ["$status", "pending"] },
                                1,
                                0,
                            ],
                        },
                    },

                    failedDonations: {
                        $sum: {
                            $cond: [
                                { $eq: ["$status", "failed"] },
                                1,
                                0,
                            ],
                        },
                    },

                    cancelledDonations: {
                        $sum: {
                            $cond: [
                                { $eq: ["$status", "cancelled"] },
                                1,
                                0,
                            ],
                        },
                    },

                    unsuccessfulDonations: {
                        $sum: {
                            $cond: [
                                { $in: ["$status", ["failed", "cancelled"]] },
                                1,
                                0,
                            ],
                        },
                    },

                    totalAmount: {
                        $sum: {
                            $cond: [
                                { $eq: ["$status", "successful"] },
                                "$amount",
                                0,
                            ],
                        },
                    },
                },
            },
        ]);

        const result = summary[0] || {
            totalDonations: 0,
            successfulDonations: 0,
            pendingDonations: 0,
            failedDonations: 0,
            cancelledDonations: 0,
            totalAmount: 0,
            unsuccessfulDonations: 0,
        };

        return res.status(200).json({
            success: true,
            summary: {
                ...result,
                _id: undefined,
            },
        });

    } catch (error) {
        console.error("Get donation summary error:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to fetch donation summary.",
        });
    }
};


// GET /api/admin/donations/:donationId
export const getAdminDonationById = async (req, res) => {
    try {
        const { donationId } = req.params;

        if (!donationId.match(/^[0-9a-fA-F]{24}$/)) {
            return res.status(400).json({
                success: false,
                message: "Invalid donation ID.",
            });
        }

        const donation = await Donation.findById(donationId)
            .populate("user", "firstName lastName email alumniId")
            .lean();

        if (!donation) {
            return res.status(404).json({
                success: false,
                message: "Donation record not found.",
            });
        }

        return res.status(200).json({
            success: true,
            donation,
        });

    } catch (error) {
        console.error("Get donation details error:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to fetch donation details.",
        });
    }
};