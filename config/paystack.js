import "dotenv/config";

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;

if (!PAYSTACK_SECRET_KEY) {
    console.warn(
        "⚠️ PAYSTACK_SECRET_KEY is not configured."
    );
}

export const paystackRequest = async (
    endpoint,
    options = {}
) => {
    const response = await fetch(
        `https://api.paystack.co${endpoint}`,
        {
            ...options,
            headers: {
                Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
                "Content-Type": "application/json",
                ...(options.headers || {}),
            },
        }
    );

    const data = await response.json();

    if (!response.ok || !data.status) {
        throw new Error(
            data.message || "Paystack request failed."
        );
    }

    return data;
};