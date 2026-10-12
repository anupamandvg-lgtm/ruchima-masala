"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  RecaptchaVerifier,
  signInWithPhoneNumber,
  type ConfirmationResult,
} from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";

type Step = "phone" | "otp";

function helperText(err: unknown): string {
  const code = (err as { code?: string })?.code ?? "";
  switch (code) {
    case "auth/invalid-phone-number":
      return "Please enter a valid 10-digit mobile number.";
    case "auth/invalid-verification-code":
      return "That code doesn't look right. Please check and try again.";
    case "auth/code-expired":
      return "This code has expired. Request a new one.";
    case "auth/too-many-requests":
      return "Too many attempts. Wait a few minutes and try again.";
    case "auth/quota-exceeded":
      return "We've hit our SMS limit for now. Please try again shortly.";
    default:
      return "Something went wrong. Please try again.";
  }
}

export function PhoneOtpForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading } = useAuth();

  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const recaptchaContainerRef = useRef<HTMLDivElement>(null);
  const verifierRef = useRef<RecaptchaVerifier | null>(null);
  const confirmationRef = useRef<ConfirmationResult | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      verifierRef.current?.clear();
      verifierRef.current = null;
    };
  }, []);

  // Already signed in → redirect.
  useEffect(() => {
    if (!loading && user && mountedRef.current) {
      const next = searchParams.get("next") ?? "/orders";
      router.replace(next);
    }
  }, [loading, user, router, searchParams]);

  // Invisible reCAPTCHA is required by Firebase Phone Auth on web to confirm
  // the request comes from an allowed domain. One instance per mount; a used
  // or expired verifier must be recreated before the next send.
  function getVerifier(): RecaptchaVerifier {
    if (!auth) throw new Error("Firebase not configured");
    if (!verifierRef.current) {
      verifierRef.current = new RecaptchaVerifier(auth, recaptchaContainerRef.current!, {
        size: "invisible",
      });
    }
    return verifierRef.current;
  }

  const sendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!auth) return;
    if (phone.length !== 10) {
      setError("Please enter a valid 10-digit mobile number.");
      return;
    }

    setBusy(true);
    try {
      const confirmation = await signInWithPhoneNumber(auth, `+91${phone}`, getVerifier());
      if (!mountedRef.current) return;
      confirmationRef.current = confirmation;
      setStep("otp");
    } catch (err) {
      if (mountedRef.current) setError(helperText(err));
      // A failed send leaves the reCAPTCHA in a used state — drop it so the
      // next attempt creates a fresh one instead of silently failing again.
      verifierRef.current?.clear();
      verifierRef.current = null;
    } finally {
      if (mountedRef.current) setBusy(false);
    }
  };

  const verifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (otp.length !== 6 || !confirmationRef.current) {
      setError("Please enter the 6-digit code.");
      return;
    }

    setBusy(true);
    try {
      await confirmationRef.current.confirm(otp);
      // onAuthStateChanged fires → redirect effect above handles navigation.
    } catch (err) {
      if (mountedRef.current) setError(helperText(err));
    } finally {
      if (mountedRef.current) setBusy(false);
    }
  };

  const changeNumber = () => {
    setStep("phone");
    setOtp("");
    setError(null);
    confirmationRef.current = null;
  };

  if (!auth) {
    return (
      <div className="rounded-xl border border-terracotta/30 bg-terracotta/5 p-4 text-center text-sm text-terracotta">
        Firebase isn&apos;t configured yet — copy <code>.env.local.example</code> to{" "}
        <code>.env.local</code> and add your Firebase web-app keys.
      </div>
    );
  }

  return (
    <div className="card w-full p-6 sm:p-8">
      {error && (
        <p className="mb-4 rounded-xl border border-terracotta/30 bg-terracotta/5 px-4 py-3 text-sm font-medium text-terracotta" role="alert">
          {error}
        </p>
      )}

      {step === "phone" ? (
        <form onSubmit={sendOtp} className="space-y-4">
          <div>
            <label htmlFor="op-phone" className="mb-1.5 block text-sm font-semibold">
              Mobile number
            </label>
            <div className="flex items-center gap-2">
              <span className="field flex w-16 items-center justify-center px-0 text-sm text-soft">
                +91
              </span>
              <input
                id="op-phone"
                type="tel"
                inputMode="numeric"
                autoComplete="tel"
                maxLength={10}
                placeholder="10-digit mobile"
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/[^\d]/g, "").slice(0, 10))}
                className="field"
                required
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={busy || phone.length !== 10}
            className="btn btn-terracotta w-full"
          >
            {busy ? "Sending code…" : "Send OTP"}
          </button>
          <p className="pt-1 text-center text-[11px] leading-relaxed text-soft">
            By signing in, you confirm you are 18+ years of age, agree to our{" "}
            <Link href="/terms" className="underline hover:text-ink">
              Terms of Service
            </Link>{" "}
            and acknowledge our{" "}
            <Link href="/privacy" className="underline hover:text-ink">
              Privacy Policy (DPDP Act, 2023)
            </Link>.
          </p>
        </form>
      ) : (
        <form onSubmit={verifyOtp} className="space-y-4">
          <div>
            <label htmlFor="op-otp" className="mb-1.5 block text-sm font-semibold">
              Enter the 6-digit code
            </label>
            <p className="mb-2 text-xs text-soft">
              Sent to <strong>+91 {phone}</strong>.{" "}
              <button
                type="button"
                onClick={changeNumber}
                className="font-semibold underline underline-offset-2 hover:text-ink"
              >
                Change number
              </button>
            </p>
            <input
              id="op-otp"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              placeholder="123456"
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/[^\d]/g, "").slice(0, 6))}
              className="field"
              required
            />
          </div>
          <button
            type="submit"
            disabled={busy || otp.length !== 6}
            className="btn btn-terracotta w-full"
          >
            {busy ? "Verifying…" : "Verify & sign in"}
          </button>
        </form>
      )}

      {/* Invisible reCAPTCHA anchor — Firebase renders no visible widget here. */}
      <div ref={recaptchaContainerRef} />
    </div>
  );
}
