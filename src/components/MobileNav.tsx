"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useCart } from "@/lib/cart-context";

import {
  BulkOrderIcon,
  CartIcon,
  HomeIcon,
  OrdersReceiptIcon,
  SettingsIcon,
  ShopIcon,
} from "./icons";

export function MobileNav() {
  const pathname = usePathname();
  const { isAdmin } = useAuth();
  const { setCartOpen, totalUnits } = useCart();

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  // White Label and About/Contact live in the desktop nav + footer only — four
  // tabs plus the conditional Admin tab and Cart button keep the bar readable
  // on a phone screen, same reasoning as rakus-kitchen's MobileNav.
  const tabs = [
    { href: "/", label: "Home", Icon: HomeIcon },
    { href: "/shop", label: "Shop", Icon: ShopIcon },
    { href: "/bulk-order", label: "Bulk", Icon: BulkOrderIcon },
    { href: "/orders", label: "Orders", Icon: OrdersReceiptIcon },
  ];

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-line/70 bg-paper/95 backdrop-blur md:hidden">
      <div className={isAdmin ? "grid grid-cols-6" : "grid grid-cols-5"}>
        {tabs.map((tab) => {
          const active = isActive(tab.href);
          const Icon = tab.Icon;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex flex-col items-center gap-1 py-2 text-[11px] font-semibold transition ${
                active ? "text-paprika" : "text-soft hover:text-cumin"
              }`}
            >
              <Icon className={`h-5 w-5 ${active ? "stroke-[2.2]" : "stroke-[1.7]"}`} />
              {tab.label}
            </Link>
          );
        })}
        {isAdmin && (
          <Link
            href="/admin"
            className={`flex flex-col items-center gap-1 py-2 text-[11px] font-semibold transition ${
              isActive("/admin") ? "text-ok font-bold" : "text-soft hover:text-cumin"
            }`}
          >
            <SettingsIcon className={`h-5 w-5 ${isActive("/admin") ? "stroke-[2.2]" : "stroke-[1.7]"}`} />
            Admin
          </Link>
        )}
        <button
          onClick={() => setCartOpen(true)}
          className="relative flex flex-col items-center gap-1 py-2 text-[11px] font-semibold text-soft hover:text-cumin"
          aria-label="Open cart"
        >
          <div className="relative">
            <CartIcon className="h-5 w-5 stroke-[1.7]" />
            {totalUnits > 0 && (
              <span className="animate-cart-pop absolute -right-2.5 -top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-terracotta px-1 text-[10px] font-bold text-cardamom">
                {totalUnits}
              </span>
            )}
          </div>
          Cart
        </button>
      </div>
    </nav>
  );
}
