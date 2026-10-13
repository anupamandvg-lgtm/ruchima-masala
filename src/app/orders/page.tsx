"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import { useCart } from "@/lib/cart-context";
import { subscribeMyOrders } from "@/lib/db";
import { PRODUCTS } from "@/lib/products";
import { formatINR } from "@/lib/format";
import { waLinkToKitchen } from "@/lib/whatsapp";
import { BUSINESS } from "@/lib/config";
import { OrderStatusSteps } from "@/components/OrderStatusSteps";
import { EmptyCartIcon, OrdersReceiptIcon, WhatsAppIcon } from "@/components/icons";
import type { Order } from "@/types";

type Tab = "active" | "past" | "all";

const ACTIVE_STATUSES = new Set<Order["status"]>(["Placed", "Paid", "Packed", "Shipped"]);
const PAST_STATUSES = new Set<Order["status"]>(["Delivered", "Cancelled", "Refunded"]);

// id === slug for every current catalog entry (see src/lib/products.ts).
const PRODUCT_BY_ID = new Map(PRODUCTS.map((p) => [p.id, p]));

export default function OrdersPage() {
  const { user, loading } = useAuth();
  const { add, setCartOpen } = useCart();
  const router = useRouter();

  const [orders, setOrders] = useState<Order[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("active");

  useEffect(() => {
    if (!loading && !user) router.replace("/login?next=%2Forders");
  }, [loading, user, router]);

  useEffect(() => {
    if (!user) return;
    setOrdersLoading(true);
    const unsub = subscribeMyOrders(
      user.uid,
      (list) => {
        setOrders(list);
        setOrdersLoading(false);
        setListError(null);
      },
      (message) => setListError(message),
    );
    return unsub;
  }, [user?.uid]);

  const filtered = useMemo(() => {
    if (tab === "active") return orders.filter((o) => ACTIVE_STATUSES.has(o.status));
    if (tab === "past") return orders.filter((o) => PAST_STATUSES.has(o.status));
    return orders;
  }, [orders, tab]);

  const reorder = (order: Order) => {
    for (const line of order.items) {
      const product = PRODUCT_BY_ID.get(line.productId);
      add({
        productId: line.productId,
        name: line.name,
        slug: product?.slug ?? line.productId,
        image: product?.images[0],
        price: line.pricePerUnit,
        quantity: line.qty,
        variantLabel: line.variantLabel,
      });
    }
    setCartOpen(true);
  };

  if (loading || (!user && !loading)) {
    return <div className="mx-auto max-w-3xl px-4 py-12 text-center text-soft">Loading…</div>;
  }
  if (!user) return null;

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:py-14">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="section-title mb-1">My Orders</h1>
          <p className="mb-6 text-sm text-soft">Track every order and reorder your favourites in a tap.</p>
        </div>
        <button
          onClick={() => { signOut(auth!); router.push("/"); }}
          className="btn btn-ghost shrink-0 text-xs"
        >
          Sign out
        </button>
      </div>

      <div className="mb-6 flex gap-2">
        {([
          ["active", "Active"],
          ["past", "Past"],
          ["all", "All"],
        ] as [Tab, string][]).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`chip ${tab === key ? "chip-active" : ""}`}
          >
            {label}
          </button>
        ))}
      </div>

      {listError && (
        <div className="mb-4 rounded-xl border border-terracotta/30 bg-terracotta/5 px-4 py-3 text-sm font-medium text-terracotta" role="alert">
          Having trouble loading your orders — retrying… ({listError})
        </div>
      )}

      {ordersLoading ? (
        <p className="py-10 text-center text-sm text-soft">Loading your orders…</p>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <EmptyCartIcon className="h-14 w-14 text-soft/50" />
          <h2 className="font-display text-lg font-semibold text-cumin">
            {tab === "active" ? "No active orders" : tab === "past" ? "No past orders yet" : "No orders yet"}
          </h2>
          <p className="text-sm text-soft">Your orders will show up here once you place one.</p>
          <Link href="/shop" className="btn btn-terracotta mt-2">Browse shop</Link>
        </div>
      ) : (
        <ul className="space-y-5">
          {filtered.map((order) => (
            <li key={order.id} className="card p-5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-display text-base font-semibold text-cumin">{order.orderId}</p>
                  <p className="text-xs text-soft">
                    {new Date(order.createdAt).toLocaleDateString("en-IN", {
                      day: "numeric", month: "short", year: "numeric",
                    })}
                  </p>
                </div>
                <p className="text-base font-bold text-cumin">{formatINR(order.grandTotal)}</p>
              </div>

              <div className="mt-4">
                <OrderStatusSteps status={order.status} fulfillmentType={order.fulfillmentType} />
              </div>

              <ul className="mt-4 divide-y divide-line/60 text-sm">
                {order.items.map((it) => (
                  <li key={`${it.productId}-${it.variantLabel}`} className="flex justify-between py-2">
                    <span className="text-soft">{it.name} ({it.variantLabel}) ×{it.qty}</span>
                    <span className="font-semibold">{formatINR(it.lineTotal)}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-4 flex flex-wrap gap-2.5">
                <button onClick={() => reorder(order)} className="btn btn-ghost text-xs">
                  🔁 Reorder
                </button>
                <a
                  href={waLinkToKitchen(order)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-ghost text-xs flex items-center gap-1.5"
                >
                  <WhatsAppIcon className="h-4 w-4" />
                  WhatsApp us about this order
                </a>
                {order.invoiceUrl && (
                  <a
                    href={order.invoiceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-ghost text-xs flex items-center gap-1.5"
                  >
                    <OrdersReceiptIcon className="h-4 w-4" />
                    Download invoice
                  </a>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* DPDP Act 2023 — consumer rights (access, correction, erasure, grievance redress) */}
      <div className="mt-10 rounded-2xl border border-line bg-cardamom/50 p-5 text-xs text-soft space-y-2">
        <div className="flex items-center gap-1.5 font-semibold text-cumin">
          <span>🛡️</span>
          <span>Your data rights under the DPDP Act, 2023</span>
        </div>
        <p className="leading-relaxed">
          You can request access to, correction of, or erasure of your personal data held by{" "}
          {BUSINESS.name} at any time. To exercise these rights or raise a grievance, contact our
          Grievance Officer, <strong className="text-cumin">{BUSINESS.grievanceOfficer.name}</strong>, at{" "}
          <a href={`mailto:${BUSINESS.grievanceOfficer.email}`} className="font-semibold text-paprika underline">
            {BUSINESS.grievanceOfficer.email}
          </a>{" "}
          or {BUSINESS.grievanceOfficer.phone}. We aim to resolve all requests within{" "}
          {BUSINESS.grievanceOfficer.slaDays} days. See our{" "}
          <Link href="/privacy" className="font-semibold text-paprika underline">Privacy Policy</Link> for details.
        </p>
      </div>
    </div>
  );
}
