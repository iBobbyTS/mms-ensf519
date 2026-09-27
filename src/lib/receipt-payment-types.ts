export const MEMBERSHIP_FEE_PAYMENT_TYPE = "Membership Fee";
export const OTHER_PAYMENT_TYPE = "Other";

export const RECEIPT_PAYMENT_TYPES = [
    MEMBERSHIP_FEE_PAYMENT_TYPE,
    "Donation",
    "Event Fee",
    "Sponsorship",
    OTHER_PAYMENT_TYPE,
] as const;

export const ORGANIZATION_RECEIPT_PAYMENT_TYPES = [
    "Donation",
    "Event Fee",
    "Sponsorship",
    OTHER_PAYMENT_TYPE,
] as const;

export function isOrganizationReceiptPayer(payerKey: string): boolean {
    return payerKey.startsWith("organization:");
}

export function isOrganizationReceiptPaymentType(paymentType: string): boolean {
    return ORGANIZATION_RECEIPT_PAYMENT_TYPES.some(
        (allowedPaymentType) => allowedPaymentType === paymentType,
    );
}

export function receiptPaymentTypesForPayer(payerKey: string): string[] {
    return isOrganizationReceiptPayer(payerKey)
        ? [...ORGANIZATION_RECEIPT_PAYMENT_TYPES]
        : [...RECEIPT_PAYMENT_TYPES];
}

export function normalizeReceiptPaymentTypeForPayer(
    payerKey: string,
    paymentType: string,
): string {
    const allowedPaymentTypes = receiptPaymentTypesForPayer(payerKey);
    return allowedPaymentTypes.includes(paymentType)
        ? paymentType
        : (allowedPaymentTypes[0] ?? "");
}
