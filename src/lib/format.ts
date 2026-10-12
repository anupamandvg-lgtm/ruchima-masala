// Shared display formatters — kept tiny and dependency-free so any
// component/lib file can import without pulling in Firestore types.

export const formatINR = (amount: number): string => `₹${amount.toLocaleString("en-IN")}`;
