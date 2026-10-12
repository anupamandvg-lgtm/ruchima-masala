interface IconProps {
  className?: string;
}

/** Hand-rolled inline SVG icons for Ruchima Masala — spice/masala themed,
 *  same conventions as rakus-kitchen's icons.tsx (viewBox 0 0 24 24,
 *  stroke="currentColor", no icon library). */
// Note: the old `LogoMark` SVG mark was replaced by the real brand wordmark
// (public/images/brand/logo-wide-h120.png) in Nav.tsx and Footer.tsx.

/* ── UI Action Icons ─────────────────────────────────────────────────── */

export const CartIcon = ({ className }: IconProps) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden
  >
    <circle cx="9" cy="21" r="1" />
    <circle cx="20" cy="21" r="1" />
    <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
  </svg>
);

export const WhatsAppIcon = ({ className }: IconProps) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="currentColor"
    className={className}
    aria-hidden
  >
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884zm8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z" />
  </svg>
);

export const PhoneIcon = ({ className }: IconProps) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden
  >
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
  </svg>
);

export const MapPinIcon = ({ className }: IconProps) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden
  >
    <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
    <circle cx="12" cy="10" r="3" />
  </svg>
);

export const ClockIcon = ({ className }: IconProps) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden
  >
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </svg>
);

/* ── Navigation Bar Vector Icons ─────────────────────────────────────── */

export const HomeIcon = ({ className = "h-5 w-5" }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    <polyline points="9 22 9 12 15 12 15 22" />
  </svg>
);

/** Shop / catalog — shopping bag */
export const ShopIcon = ({ className = "h-5 w-5" }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M6 7h12l1 13a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 5 20z" />
    <path d="M9 7V5a3 3 0 0 1 6 0v2" />
  </svg>
);

/** Bulk / wholesale order — stacked crate */
export const BulkOrderIcon = ({ className = "h-5 w-5" }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M3 7l9-4 9 4-9 4-9-4z" />
    <path d="M3 7v10l9 4 9-4V7" />
    <path d="M12 11v10" />
  </svg>
);

/** White-label program — brand tag */
export const WhiteLabelIcon = ({ className = "h-5 w-5" }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M20.59 13.41 11 3.83A2 2 0 0 0 9.59 3.24L4 3a1 1 0 0 0-1 1l.24 5.59a2 2 0 0 0 .59 1.41l9.58 9.58a2 2 0 0 0 2.83 0l4.35-4.35a2 2 0 0 0 0-2.82z" />
    <circle cx="7.5" cy="7.5" r="1.2" fill="currentColor" stroke="none" />
  </svg>
);

export const OrdersReceiptIcon = ({ className = "h-5 w-5" }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1z" />
    <line x1="8" y1="6" x2="16" y2="6" />
    <line x1="8" y1="10" x2="16" y2="10" />
    <line x1="8" y1="14" x2="12" y2="14" />
  </svg>
);

export const SettingsIcon = ({ className = "h-5 w-5" }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
);

/* ── Shop Category Filter Icons ───────────────────────────────────────── */

export const MasalaPowderCategoryIcon = ({ className = "h-4 w-4" }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M4 18c0-4 3.5-7 8-7s8 3 8 7" />
    <path d="M4 18h16" />
    <circle cx="9" cy="13" r=".5" fill="currentColor" stroke="none" />
    <circle cx="15" cy="12" r=".5" fill="currentColor" stroke="none" />
    <circle cx="12" cy="10.5" r=".5" fill="currentColor" stroke="none" />
  </svg>
);

export const SpiceBlendCategoryIcon = ({ className = "h-4 w-4" }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <circle cx="12" cy="13" r="7" />
    <path d="M8 13h8" />
    <path d="M12 9v8" />
    <path d="M9.5 10.5l5 5" />
    <path d="M14.5 10.5l-5 5" />
  </svg>
);

export const WholeSpiceCategoryIcon = ({ className = "h-4 w-4" }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M9 4c3 0 7 3 7 8s-3 8-6 8c-2 0-3-1.5-3-3 0-2 2-2 2-4s-2-2-2-4 1-3 2-5z" />
    <path d="M9 4c-1-1-2-1-3-.5" />
  </svg>
);

export const InstantMixCategoryIcon = ({ className = "h-4 w-4" }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M6 3h12l1 6-1 12H7L6 9z" />
    <path d="M9 3v3" />
    <path d="M15 3v3" />
    <path d="M8 13h8" />
  </svg>
);

/* ── Homepage Category Tile Icons ─────────────────────────────────────────── */

/** Masala Powders tile — spice mound with sprinkled grains */
export const MasalaPowderTileIcon = ({ className = "h-8 w-8" }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
    <path d="M4 19c0-5 3.5-8.5 8-8.5s8 3.5 8 8.5" />
    <path d="M3 19h18" />
    <circle cx="9" cy="13.5" r=".6" fill="currentColor" stroke="none" />
    <circle cx="15" cy="12.5" r=".6" fill="currentColor" stroke="none" />
    <circle cx="12" cy="11" r=".6" fill="currentColor" stroke="none" />
    <circle cx="12" cy="15" r=".6" fill="currentColor" stroke="none" />
  </svg>
);

/** Spice Blends tile — mixing symbol */
export const SpiceBlendTileIcon = ({ className = "h-8 w-8" }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
    <circle cx="12" cy="13" r="8" />
    <path d="M7 13h10" />
    <path d="M12 8v10" />
    <path d="M8.8 9.8l6.4 6.4" />
    <path d="M15.2 9.8l-6.4 6.4" />
  </svg>
);

/** Whole Spices tile — dried chilli pod with peppercorns */
export const WholeSpiceTileIcon = ({ className = "h-8 w-8" }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
    <path d="M9.5 3.5c3.5 0 8 3.5 8 9.5s-3.5 9.5-7 9.5c-2.3 0-3.5-1.7-3.5-3.5 0-2.3 2.3-2.3 2.3-4.6s-2.3-2.3-2.3-4.6 1.2-4.3 2.5-6.3z" />
    <path d="M9.5 3.5c-1.2-1.2-2.3-1.2-3.5-.5" />
    <circle cx="18" cy="19" r="1" fill="currentColor" stroke="none" />
    <circle cx="20" cy="16.5" r=".8" fill="currentColor" stroke="none" />
  </svg>
);

/** Instant Mixes tile — sealed sachet/pouch */
export const InstantMixTileIcon = ({ className = "h-8 w-8" }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
    <path d="M6 4h12l1 7-1 13H7L6 11z" />
    <path d="M9 4v3" />
    <path d="M15 4v3" />
    <path d="M7.5 15h9" />
    <path d="M8.5 19h7" />
  </svg>
);

/* ── Homepage Pillar / Trust Icons ────────────────────────────────────────── */

/** Fresh Ingredients — leaf sprout */
export const FreshIngredientsIcon = ({ className = "h-8 w-8" }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
    <path d="M12 22V12" />
    <path d="M12 12C12 7 7 4 3 5c0 5 3 8 9 7z" />
    <path d="M12 12c0-5 5-8 9-7 0 5-3 8-9 7z" />
  </svg>
);

/** Authentic Taste — flame */
export const AuthenticTasteIcon = ({ className = "h-8 w-8" }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
    <path d="M12 2c0 6-6 8-6 13a6 6 0 0 0 12 0c0-5-6-7-6-13z" />
    <path d="M12 12c0 3-2 4-2 6a2 2 0 0 0 4 0c0-2-2-3-2-6z" />
  </svg>
);

/** Hygienic Preparation — shield with checkmark */
export const HygienicPrepIcon = ({ className = "h-8 w-8" }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    <polyline points="9 12 11 14 15 10" />
  </svg>
);

/* ── Cart / Empty State Icons ─────────────────────────────────────────────── */

/** Empty cart state — jar outline */
export const EmptyCartIcon = ({ className = "h-14 w-14" }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
    <path d="M7 9h10v9a3 3 0 0 1-3 3h-4a3 3 0 0 1-3-3z" />
    <path d="M8 9V6a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v3" />
    <path d="M9.5 2h5" />
  </svg>
);

/** Product line-item fallback — small spice jar */
export const ProductPlaceholderIcon = ({ className = "h-6 w-6" }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
    <path d="M7 9h10v10a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2z" />
    <path d="M8.5 9V6.5a1 1 0 0 1 1-1h5a1 1 0 0 1 1 1V9" />
  </svg>
);
