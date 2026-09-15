import Payment from "../models/Payment.js";

export const getMyPayments = async (req, res) => {
    try {
        const payments = await Payment.find({
            user: req.user._id,
        })
            .populate({
                path: "obligationAssignment",
                select: "amountDue amountPaid status dueDate",
                populate: {
                    path: "obligation",
                    select: "name category year",
                },
            })
            .sort({ createdAt: -1 })
            .lean();

        const summary = {
            totalPaid: 0,
            successful: 0,
            pending: 0,
            failed: 0,
        };

        payments.forEach((payment) => {
            if (payment.status === "successful") {
                summary.totalPaid += payment.amount;
                summary.successful += 1;
            }

            if (payment.status === "pending") {
                summary.pending += 1;
            }

            if (
                payment.status === "failed" ||
                payment.status === "cancelled"
            ) {
                summary.failed += 1;
            }
        });

        res.status(200).json({
            success: true,
            summary,
            payments,
        });
    } catch (error) {
        console.error(
            "Get payment history error:",
            error
        );

        res.status(500).json({
            success: false,
            message: "Failed to load payment history.",
        });
    }
};