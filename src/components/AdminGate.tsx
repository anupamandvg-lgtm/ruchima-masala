"use client";

import { useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import Link from "next/link";
import { auth } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";

/**
 * Reusable admin authentication gate — wraps any admin page. Shows loading
 * state while auth is initializing, redirects to login if not signed in,
 * and shows an "admins only" message if the user is signed in but not on
 * the admin allowlist.
 */
export function AdminGate({ children }: { children: React.ReactNode }) {
  const { user, loading, isAdmin } = useAuth();
  const router = useRouter();

  // Still initializing — show a neutral loading state.
  if (loading) {
    return <div className="mx-auto max-w-5xl px-4 py-12 text-center text-soft">Loading…</div>;
  }

  // Not signed in — bounce to login with a return URL.
  if (!user) {
    router.replace("/login?next=%2Fadmin");
    return null;
  }

  // Signed in but not an admin — explain why and offer sign-out.
  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <span className="text-5xl" aria-hidden>🔒</span>
        <h1 className="section-title mt-4">Admins only</h1>
        <p className="mt-2 text-sm text-soft">
          You&apos;re signed in as <span className="font-semibold text-cumin">{user.phoneNumber ?? user.email ?? user.uid}</span> ({user.uid}),
          but this account isn&apos;t on the admin list. An existing admin needs to add it under{" "}
          <code className="rounded bg-cardamom px-1.5 py-0.5 text-xs">/admins/&lt;your-uid&gt;</code> in Firestore.
        </p>
        <div className="mt-5 flex justify-center gap-2">
          <Link href="/orders" className="btn btn-ghost px-4 py-2 text-xs">My orders</Link>
          <button onClick={() => { signOut(auth!); router.push("/"); }} className="btn btn-ghost px-4 py-2 text-xs">
            Sign out
          </button>
        </div>
      </div>
    );
  }

  // Passed all checks — render the protected content.
  return <>{children}</>;
}
