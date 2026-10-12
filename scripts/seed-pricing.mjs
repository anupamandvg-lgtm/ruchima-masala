// One-off bulk seed for the productPricing Firestore collection.
//
// Why this exists: src/lib/products.ts deliberately holds NO price (see its
// header comment) — selling price lives only in Firestore at
// productPricing/{productId}, normally entered by hand via /admin/inventory.
// With that collection empty, every product on /shop falls back to "Price on
// request" / disabled "N/A" add-to-cart (see src/components/ProductCard.tsx).
// This script writes the real catalog prices in one pass instead of 29
// manual admin-page edits.
//
// Usage:
//   node --env-file=.env.local scripts/seed-pricing.mjs           # dry run (prints only)
//   node --env-file=.env.local scripts/seed-pricing.mjs --apply   # actually writes
//
// Requires FIREBASE_ADMIN_PROJECT_ID / _CLIENT_EMAIL / _PRIVATE_KEY in
// .env.local (same service account used by src/lib/server/firebaseAdmin.ts).

import { cert, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

// productId (must match src/lib/products.ts) -> variant label -> prices.
// Source: business-provided catalog pricing sheet (2026-10-12).
const PRICING = {
  "bright-chilli-powder": { "1 kg": { sellingPrice: 299, originalPrice: 499 } },
  "export-chilli-powder": { "500 g": { sellingPrice: 165, originalPrice: 350 } },
  "kashmiri-chilli-powder": { "500 g": { sellingPrice: 249, originalPrice: 450 } },
  "dhaniya-powder": { "1 kg": { sellingPrice: 239, originalPrice: 280 } },
  "turmeric-powder": { "1 kg": { sellingPrice: 249, originalPrice: 320 } },
  "jeera-powder": { "500 g": { sellingPrice: 129, originalPrice: 215 } },
  "white-pepper": { "500 g": { sellingPrice: 129, originalPrice: 190 } },
  "black-pepper-spicy": { "500 g": { sellingPrice: 139, originalPrice: 349 } },
  "egg-masala": { "500 g": { sellingPrice: 139, originalPrice: 210 } },

  "fish-masala-mangalore": { "500 g": { sellingPrice: 145, originalPrice: 280 } },
  "kitchen-king": { "500 g": { sellingPrice: 149, originalPrice: 480 } },
  "sambar-powder-spicy": { "1 kg": { sellingPrice: 289, originalPrice: 480 } },
  "sambar-powder-medium-spicy": { "1 kg": { sellingPrice: 259, originalPrice: 450 } },
  "rasam-powder": { "1 kg": { sellingPrice: 269, originalPrice: 460 } },
  "dum-biryani-masala": { "1 kg": { sellingPrice: 259, originalPrice: 390 } },
  "grand-mutton-masala": { "1 kg": { sellingPrice: 259, originalPrice: 390 } },
  "royal-garam-masala": { "1 kg": { sellingPrice: 259, originalPrice: 380 } },
  "chat-masala": { "500 g": { sellingPrice: 139, originalPrice: 230 } },
  "tandoori-masala": { "500 g": { sellingPrice: 129, originalPrice: 199 } },
  "kabab-masala": { "1 kg": { sellingPrice: 259, originalPrice: 360 } },
  "pulyogre-powder": { "1 kg": { sellingPrice: 299, originalPrice: 560 } },
  "melkote-temple-style": { "1 kg": { sellingPrice: 349, originalPrice: 699 } },
  "grand-chicken-masala": { "1 kg": { sellingPrice: 259, originalPrice: 380 } },
  "tomato-tango-masala": { "250 g": { sellingPrice: 85, originalPrice: 149 } },
  "chilli-garlic-fire-masala": { "250 g": { sellingPrice: 85, originalPrice: 149 } },
  "magic-masala": { "250 g": { sellingPrice: 95, originalPrice: 199 } },
  "korean-peri-peri-masala": {
    "250 g": { sellingPrice: 99, originalPrice: 169 },
    "500 g": { sellingPrice: 189, originalPrice: 399 },
  },

  "pani-puri-instant": { "250 g": { sellingPrice: 89, originalPrice: 149 } },
  "bisi-bele-bath": { "500 g": { sellingPrice: 179, originalPrice: 290 } },
  "vangi-bath": { "500 g": { sellingPrice: 179, originalPrice: 290 } },
};

const apply = process.argv.includes("--apply");

function initAdmin() {
  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!projectId || !clientEmail || !privateKey) {
    console.error(
      "Firebase Admin not configured — set FIREBASE_ADMIN_PROJECT_ID, " +
        "FIREBASE_ADMIN_CLIENT_EMAIL and FIREBASE_ADMIN_PRIVATE_KEY in .env.local " +
        "(same service account used by src/lib/server/firebaseAdmin.ts).",
    );
    process.exit(1);
  }

  return initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
}

async function main() {
  console.log(`Mode: ${apply ? "APPLY (writing to Firestore)" : "DRY RUN (no writes — pass --apply to commit)"}\n`);

  const productIds = Object.keys(PRICING);
  console.log(`${productIds.length} products to seed:\n`);

  if (!apply) {
    // Dry run never touches Firestore, so it needs no credentials at all —
    // just prints what --apply would write.
    for (const productId of productIds) {
      console.log(`  [dry-run] ${productId}: ${JSON.stringify(PRICING[productId])}`);
    }
    console.log("\nNo writes made. Re-run with --apply to commit these to Firestore.");
    return;
  }

  const app = initAdmin();
  const db = getFirestore(app);

  const batch = db.batch();
  for (const productId of productIds) {
    const ref = db.collection("productPricing").doc(productId);
    batch.set(ref, { variants: PRICING[productId], updatedAt: Date.now() }, { merge: true });
    console.log(`  [queued] ${productId}: ${JSON.stringify(PRICING[productId])}`);
  }
  await batch.commit();
  console.log(`\nDone — wrote ${productIds.length} productPricing documents.`);
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
