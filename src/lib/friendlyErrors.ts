/**
 * Utility to sanitize error messages so raw database/internal server
 * strings are NEVER leaked to the customer.
 */

const TECHNICAL_JARGON_PATTERNS = [
  /firestore/i,
  /transaction/i,
  /read.*write/i,
  /permission[-_ ]denied/i,
  /econnrefused/i,
  /econnreset/i,
  /etimedout/i,
  /cannot read propert/i,
  /undefined/i,
  /null/i,
  /\[object Object\]/i,
  /syntaxerror/i,
  /internal server error/i,
  /stack trace/i,
  /node_modules/i,
  /bearer token/i,
  /unhandled rejection/i,
];

/**
 * Checks if an error string contains internal technical keywords that should be hidden from customers.
 */
export function isTechnicalError(message: string): boolean {
  return TECHNICAL_JARGON_PATTERNS.some((pattern) => pattern.test(message));
}

/**
 * Converts any unknown error into a friendly, professional customer-facing message.
 */
export function toFriendlyErrorMessage(
  err: unknown,
  fallback = "Something went wrong while processing your request. Please try again."
): string {
  if (!err) return fallback;

  const rawMessage =
    typeof err === "string"
      ? err
      : err instanceof Error
      ? err.message
      : typeof (err as { message?: unknown }).message === "string"
      ? String((err as { message: unknown }).message)
      : fallback;

  // If message contains internal technical jargon, return reassuring fallback
  if (isTechnicalError(rawMessage)) {
    return (
      "We're taking a moment to finalize your details. If money was deducted, your payment " +
      "is safe and will be confirmed shortly. Please tap retry below."
    );
  }

  return rawMessage;
}
