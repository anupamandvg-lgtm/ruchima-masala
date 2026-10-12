// Business configuration — single place to tune how Ruchima Masala presents itself.

export const BUSINESS = {
  name: "Ruchima Masala",
  tagline: "Authentic & Tasty, Straight From the Mill",
  instagram: "ruchima.family",
  instagramUrl: "https://instagram.com/ruchima.family",
  phoneDisplay: "+91 98868 95220",
  phone: "9886895220",
  phoneIntl: "919886895220", // for wa.me links
  address: "Vidyamanya Nagar, Andrahalli / Vishwaneedam, Bangalore, Karnataka",
  gstStateCode: "29", // Karnataka — used to decide CGST+SGST vs IGST on invoices
  // TODO(business): confirm exact warehouse coordinates for Porter/courier pickup point.
  lat: 13.0251,
  lng: 77.4792,
  warehouseAddress: "Vidyamanya Nagar, Andrahalli, Bengaluru, Karnataka 560091",
  // TODO(business): confirm GSTIN, FSSAI license number for invoice footer & About page.
  gstin: "",
  fssaiLicenseNo: "",
  // DPDP Act 2023 & DPDP Rules 2025: Designated Grievance Officer
  grievanceOfficer: {
    name: "TBD",
    designation: "Data Protection & Grievance Officer",
    email: "grievance@ruchimamasala.in",
    backupEmail: "ruchimamasalablr@gmail.com",
    phone: "+91 98868 95220",
    address: "Vidyamanya Nagar, Andrahalli, Bengaluru, Karnataka 560091",
    slaDays: 15,
  },
} as const;

/**
 * Shipping fee policy — kept as a code default but mirrored into the
 * `shippingConfig` Firestore doc so the business can tune it without a
 * deploy (see src/lib/server/shipping.ts). This constant is only the
 * fallback used before that doc is ever written.
 *
 * OPEN QUESTION (confirm with client): flat fee under a threshold, free
 * above it, or always free? Defaulting to "free above ₹999, else ₹79".
 */
export const DEFAULT_SHIPPING_POLICY = {
  flatFee: 79,
  freeAboveAmount: 999,
} as const;
