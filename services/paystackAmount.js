export const isPaystackAmountValid = (payment, transaction) => {
    const expectedAmount = Math.round(
        Number(payment.amount) * 100
    );

    // Prefer Paystack's original requested amount.
    if (
        transaction?.requested_amount !== undefined &&
        transaction?.requested_amount !== null
    ) {
        return (
            Number(transaction.requested_amount) ===
            expectedAmount
        );
    }

    // Fallback: account for the transaction fee.
    if (
        transaction?.fees !== undefined &&
        transaction?.fees !== null &&
        Number.isFinite(Number(transaction.fees))
    ) {
        return (
            Number(transaction.amount) -
            Number(transaction.fees) === expectedAmount
        );
    }

    // If fee details aren't available, require an exact match.
    return Number(transaction?.amount) === expectedAmount;
};