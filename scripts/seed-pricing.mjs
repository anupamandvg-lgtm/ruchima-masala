// One-off bulk seed for the productPricing Firestore collection.
//
// Generates accurate wholesale & retail tier pricing for all official
// Ruchima Masala business packing sizes:
// 500 g | 1 kg | 2 kg | 3 kg | 5 kg | 10 kg | 20 kg | 25 kg | 50 kg
// (and 250 g for specialty blends).
//
// Usage:
//   node --env-file=.env.local scripts/seed-pricing.mjs           # dry run (prints only)
//   node --env-file=.env.local scripts/seed-pricing.mjs --apply   # actually writes
//
// Requires FIREBASE_ADMIN_PROJECT_ID / _CLIENT_EMAIL / _PRIVATE_KEY in .env.local

import { cert, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

// Base pricing benchmarks (from business-provided catalog pricing sheet).
const BASE_CATALOG = {
  "bright-chilli-powder": { baseVariant: "1 kg", baseGrams: 1000, sellingPrice: 299, originalPrice: 499 },
  "export-chilli-powder": { baseVariant: "500 g", baseGrams: 500, sellingPrice: 165, originalPrice: 350 },
  "kashmiri-chilli-powder": { baseVariant: "500 g", baseGrams: 500, sellingPrice: 249, originalPrice: 450 },
  "dhaniya-powder": { baseVariant: "1 kg", baseGrams: 1000, sellingPrice: 239, originalPrice: 280 },
  "turmeric-powder": { baseVariant: "1 kg", baseGrams: 1000, sellingPrice: 249, originalPrice: 320 },
  "jeera-powder": { baseVariant: "500 g", baseGrams: 500, sellingPrice: 129, originalPrice: 215 },
  "white-pepper": { baseVariant: "500 g", baseGrams: 500, sellingPrice: 129, originalPrice: 190 },
  "black-pepper-spicy": { baseVariant: "500 g", baseGrams: 500, sellingPrice: 139, originalPrice: 349 },
  "egg-masala": { baseVariant: "500 g", baseGrams: 500, sellingPrice: 139, originalPrice: 210 },

  "fish-masala-mangalore": { baseVariant: "500 g", baseGrams: 500, sellingPrice: 145, originalPrice: 280 },
  "kitchen-king": { baseVariant: "500 g", baseGrams: 500, sellingPrice: 149, originalPrice: 480 },
  "sambar-powder-spicy": { baseVariant: "1 kg", baseGrams: 1000, sellingPrice: 289, originalPrice: 480 },
  "sambar-powder-medium-spicy": { baseVariant: "1 kg", baseGrams: 1000, sellingPrice: 259, originalPrice: 450 },
  "rasam-powder": { baseVariant: "1 kg", baseGrams: 1000, sellingPrice: 269, originalPrice: 460 },
  "dum-biryani-masala": { baseVariant: "1 kg", baseGrams: 1000, sellingPrice: 259, originalPrice: 390 },
  "grand-mutton-masala": { baseVariant: "1 kg", baseGrams: 1000, sellingPrice: 259, originalPrice: 390 },
  "royal-garam-masala": { baseVariant: "1 kg", baseGrams: 1000, sellingPrice: 259, originalPrice: 380 },
  "chat-masala": { baseVariant: "500 g", baseGrams: 500, sellingPrice: 139, originalPrice: 230 },
  "tandoori-masala": { baseVariant: "500 g", baseGrams: 500, sellingPrice: 129, originalPrice: 199 },
  "kabab-masala": { baseVariant: "1 kg", baseGrams: 1000, sellingPrice: 259, originalPrice: 360 },
  "pulyogre-powder": { baseVariant: "1 kg", baseGrams: 1000, sellingPrice: 299, originalPrice: 560 },
  "melkote-temple-style": { baseVariant: "1 kg", baseGrams: 1000, sellingPrice: 349, originalPrice: 699 },
  "grand-chicken-masala": { baseVariant: "1 kg", baseGrams: 1000, sellingPrice: 259, originalPrice: 380 },

  "tomato-tango-masala": { baseVariant: "250 g", baseGrams: 250, sellingPrice: 85, originalPrice: 149, isSpecialty: true },
  "chilli-garlic-fire-masala": { baseVariant: "250 g", baseGrams: 250, sellingPrice: 85, originalPrice: 149, isSpecialty: true },
  "magic-masala": { baseVariant: "250 g", baseGrams: 250, sellingPrice: 95, originalPrice: 199, isSpecialty: true },
  "korean-peri-peri-masala": { baseVariant: "250 g", baseGrams: 250, sellingPrice: 99, originalPrice: 169, isSpecialty: true },
  "pani-puri-instant": { baseVariant: "250 g", baseGrams: 250, sellingPrice: 89, originalPrice: 149, isSpecialty: true },

  "bisi-bele-bath": { baseVariant: "500 g", baseGrams: 500, sellingPrice: 179, originalPrice: 290 },
  "vangi-bath": { baseVariant: "500 g", baseGrams: 500, sellingPrice: 179, originalPrice: 290 },
};

const STANDARD_SIZES = [
  { label: "500 g", grams: 500 },
  { label: "1 kg", grams: 1000 },
  { label: "2 kg", grams: 2000 },
  { label: "3 kg", grams: 3000 },
  { label: "5 kg", grams: 5000 },
  { label: "10 kg", grams: 10000 },
  { label: "20 kg", grams: 20000 },
  { label: "25 kg", grams: 25000 },
  { label: "50 kg", grams: 50000 },
];

const SPECIALTY_SIZES = [
  { label: "250 g", grams: 250 },
  { label: "500 g", grams: 500 },
  { label: "1 kg", grams: 1000 },
  { label: "2 kg", grams: 2000 },
  { label: "3 kg", grams: 3000 },
  { label: "5 kg", grams: 5000 },
  { label: "10 kg", grams: 10000 },
];

function computeVariantsPricing(item) {
  const sizes = item.isSpecialty ? SPECIALTY_SIZES : STANDARD_SIZES;
  const unitRateSelling = item.sellingPrice / item.baseGrams;
  const unitRateMrp = (item.originalPrice || item.sellingPrice * 1.5) / item.baseGrams;

  const result = {};
  for (const { label, grams } of sizes) {
    // If it's the exact base variant, preserve exact benchmark price
    if (label === item.baseVariant) {
      result[label] = {
        sellingPrice: item.sellingPrice,
        originalPrice: item.originalPrice,
      };
      continue;
    }

    // Wholesale volume discount curve: larger sacks get up to 22% additional manufacturer direct discount
    let volumeDiscountFactor = 1.0;
    if (grams <= 250) volumeDiscountFactor = 1.08;
    else if (grams <= 500) volumeDiscountFactor = 1.05;
    else if (grams === 1000) volumeDiscountFactor = 1.00;
    else if (grams === 2000) volumeDiscountFactor = 0.98;
    else if (grams === 3000) volumeDiscountFactor = 0.96;
    else if (grams === 5000) volumeDiscountFactor = 0.92;
    else if (grams === 10000) volumeDiscountFactor = 0.88;
    else if (grams === 20000) volumeDiscountFactor = 0.85;
    else if (grams === 25000) volumeDiscountFactor = 0.83;
    else if (grams >= 50000) volumeDiscountFactor = 0.78;

    const computedSelling = Math.round(unitRateSelling * grams * volumeDiscountFactor);
    const computedMrp = Math.round(unitRateMrp * grams);

    result[label] = {
      sellingPrice: computedSelling,
      originalPrice: computedMrp,
    };
  }
  return result;
}

const apply = process.argv.includes("--apply");

function initAdmin() {
  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!projectId || !clientEmail || !privateKey) {
    console.error("Firebase Admin credentials not set in .env.local");
    process.exit(1);
  }

  return initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
}

async function main() {
  console.log(`Mode: ${apply ? "APPLY (writing to Firestore)" : "DRY RUN (pass --apply to commit)"}\n`);

  const productIds = Object.keys(BASE_CATALOG);
  console.log(`Generating multi-variant pricing for ${productIds.length} products...\n`);

  const allPricing = {};
  for (const id of productIds) {
    allPricing[id] = computeVariantsPricing(BASE_CATALOG[id]);
  }

  if (!apply) {
    for (const [id, variants] of Object.entries(allPricing)) {
      console.log(`[dry-run] ${id} (${Object.keys(variants).length} variants):`);
      for (const [variant, price] of Object.entries(variants)) {
        console.log(`    ${variant.padEnd(8)} -> ₹${price.sellingPrice} (MRP ₹${price.originalPrice})`);
      }
    }
    console.log("\nDry run completed. Run with --apply to commit to Firestore.");
    return;
  }

  const app = initAdmin();
  const db = getFirestore(app);

  const batch = db.batch();
  for (const [id, variants] of Object.entries(allPricing)) {
    const ref = db.collection("productPricing").doc(id);
    batch.set(ref, { variants, updatedAt: Date.now() }, { merge: true });
    console.log(`[queued] ${id} with ${Object.keys(variants).length} packing sizes`);
  }
  await batch.commit();
  console.log(`\nSuccessfully wrote multi-variant pricing for ${productIds.length} products to Firestore!`);
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
