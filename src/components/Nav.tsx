"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import { useCart } from "@/lib/cart-context";
import { CartIcon } from "./icons";

const LINKS = [
  { href: "/", label: "Home" },
  { href: "/shop", label: "Shop" },
  { href: "/bulk-order", label: "Bulk Order" },
  { href: "/white-label", label: "White Label" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
];

export function Nav() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isAdmin } = useAuth();
  const { totalUnits, setCartOpen } = useCart();

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-white/95 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
        <Link href="/" className="flex items-center gap-2">
          <Image
            src="/images/brand/logo-wide-h120.png"
            alt="Ruchima Masala"
            width={246}
            height={120}
            priority
            className="h-10 w-auto sm:h-11"
          />
        </Link>

        {/* Desktop links */}
        <nav className="hidden items-center gap-1 md:flex">
          {LINKS.map((link) => {
            const active = link.href === "/" ? pathname === "/" : pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`rounded-full px-3.5 py-2 text-sm font-semibold transition ${
                  active ? "bg-terracotta/10 text-terracotta" : "text-soft hover:text-cumin"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
          {isAdmin && (
            <Link
              href="/admin"
              className={`inline-flex rounded-full px-3.5 py-2 text-sm font-semibold transition ${
                pathname.startsWith("/admin")
                  ? "bg-ok/10 text-ok"
                  : "text-soft hover:text-cumin"
              }`}
            >
              Admin
            </Link>
          )}
        </nav>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setCartOpen(true)}
            aria-label="Open cart"
            className="relative rounded-full border border-line bg-paper p-2.5 text-cumin transition hover:border-soft"
          >
            <CartIcon className="h-5 w-5" />
            {totalUnits > 0 && (
              <span className="animate-cart-pop absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-terracotta px-1 text-[11px] font-bold text-cardamom">
                {totalUnits}
              </span>
            )}
          </button>

          {user ? (
            <>
              <Link
                href="/orders"
                className="hidden rounded-full bg-ok px-4 py-2 text-sm font-semibold text-cardamom transition hover:opacity-90 sm:inline-flex"
              >
                My Orders
              </Link>
              <button
                onClick={() => { signOut(auth!); router.push("/"); }}
                className="hidden rounded-full border border-line px-4 py-2 text-sm font-semibold text-soft transition hover:border-soft hover:text-cumin sm:inline-flex"
              >
                Sign out
              </button>
            </>
          ) : (
            <Link
              href="/login"
              className="hidden rounded-full bg-terracotta px-4 py-2 text-sm font-semibold text-cardamom transition hover:bg-paprika sm:inline-flex"
            >
              Log in
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
