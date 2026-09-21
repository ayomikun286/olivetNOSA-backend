export const NOTIFICATION_MESSAGES = {
    account: {
        welcome: {
            title: "Welcome to OlivetNOSA",
            message:
                "Your account has been created successfully. Please verify your email to continue, then complete the remaining information required for the member directory.",
            link: "/portal/member/dashboard/profile",
        },

        profileIncomplete: {
            title: "Complete Your Member Profile",
            message:
                "Some information required for the OlivetNOSA member directory is still missing. Please complete your profile.",
            link: "/dashboard/profile",
        },

        directoryIncomplete: {
            title: "Complete Your Directory Information",
            message:
                "Please provide the remaining information required for your OlivetNOSA member directory profile.",
            link: "/dashboard/directory",
        },

        verificationRequired: {
            title: "Verify Your Email",
            message:
                "Please verify your email address to continue with your OlivetNOSA membership application.",
            link: "/verify-email",
        },

        approved: {
            title: "Membership Approved",
            message:
                "Your OlivetNOSA membership has been approved. Your member account is now active.",
            link: "/portal/member/dashboard/dashboard",
        },

        obligation: {
            created: (amount, obligationName) => ({
                title: "New Payment Obligation",
                message: `A new payment obligation, ${obligationName}, of ₦${amount.toLocaleString()} has been added to your account. Please review the details and make payment when due.`,
                link: "/dashboard/obligations",
            }),
            
        
        
        
        },


            suspended: {
                title: "Account Status Updated",
                message:
                    "Your OlivetNOSA member account has been temporarily suspended. Please contact the association for further information.",
                link: "/dashboard/profile",
            },

            reactivated: {
                title: "Account Reactivated",
                message:
                    "Your OlivetNOSA member account has been reactivated and is now available for use.",
                link: "/dashboard",
            },
        },

        obligation: {
            created: {
                title: "New Payment Obligation",
                message:
                    "A new payment obligation has been added to your account. Please review the obligation details and make payment when due.",
                link: "/dashboard/obligations",
            },

            dueSoon: {
                title: "Payment Due Soon",
                message:
                    "You have an upcoming payment obligation. Please review your outstanding obligations and make payment before the due date.",
                link: "/dashboard/obligations",
            },

            overdue: {
                title: "Payment Overdue",
                message:
                    "One or more of your payment obligations are overdue. Please review your outstanding obligations and make the required payment.",
                link: "/dashboard/obligations",
            },

            paid: {
                title: "Obligation Paid",
                message:
                    "Your payment obligation has been fully settled. Thank you for keeping your OlivetNOSA account up to date.",
                link: "/dashboard/obligations",
            },
        },

        payment: {
            successful: {
                title: "Payment Successful",
                message:
                    "Your payment has been received successfully. Your account has been updated with the payment.",
                link: "/dashboard/payments",
            },

            failed: {
                title: "Payment Unsuccessful",
                message:
                    "Your payment could not be completed. Please try again or use another available payment method.",
                link: "/dashboard/obligations",
            },

            partial: {
                title: "Payment Received",
                message:
                    "Your payment has been received and applied to your outstanding obligation. A remaining balance is still due.",
                link: "/dashboard/obligations",
            },

            receipt: {
                title: "Payment Receipt Available",
                message:
                    "Your payment receipt is now available. You can view your payment details from your payment history.",
                link: "/dashboard/payments",
            },

            refunded: {
                title: "Payment Refunded",
                message:
                    "A payment associated with your OlivetNOSA account has been refunded. Please review your payment history for details.",
                link: "/dashboard/payments",
            },
        },

        announcement: {
            new: {
                title: "New Announcement",
                message:
                    "A new announcement has been posted by OlivetNOSA. Tap to view the latest information.",
                link: "/dashboard/announcements",
            },

            event: {
                title: "New Event",
                message:
                    "A new OlivetNOSA event has been added. View the event details and schedule.",
                link: "/dashboard/events",
            },

            reminder: {
                title: "Event Reminder",
                message:
                    "This is a reminder about an upcoming OlivetNOSA event.",
                link: "/dashboard/events",
            },
        },

        system: {
            security: {
                title: "Security Notice",
                message:
                    "There has been a security-related change to your OlivetNOSA account. Please review your account information.",
                link: "/dashboard/profile",
            },

            informationUpdated: {
                title: "Account Information Updated",
                message:
                    "Your OlivetNOSA account information has been updated.",
                link: "/dashboard/profile",
            },
        },
    };