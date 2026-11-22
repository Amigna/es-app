import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

// What the browser may load, by kind. Pages are prerendered with Cache Components, so nonces
// can't be used and Next's own inline scripts need 'unsafe-inline'. The outside hosts are:
// Firebase sign-in and Firestore (*.googleapis.com, and the sign-in iframe on the auth domain),
// Google sign-in (apis.google.com), App Check's reCAPTCHA (google.com and gstatic.com)
// and Google Analytics (googletagmanager.com, google-analytics.com).
// A new outside service needs its host added here, or the browser will refuse it once this is enforced.
const csp = {
  "default-src": ["'self'"],
  "script-src": [
    "'self'",
    "'unsafe-inline'",
    ...(isDev ? ["'unsafe-eval'"] : []),
    "https://apis.google.com",
    "https://www.google.com/recaptcha/",
    "https://www.gstatic.com/recaptcha/",
    "https://*.googletagmanager.com",
  ],
  "style-src": ["'self'", "'unsafe-inline'"],
  "img-src": ["'self'", "data:", "blob:", "https://*.google-analytics.com", "https://*.googletagmanager.com"],
  "font-src": ["'self'", "data:"],
  "connect-src": [
    "'self'",
    ...(isDev ? ["ws:"] : []),
    "https://*.googleapis.com",
    "https://www.google.com/recaptcha/",
    "https://*.google-analytics.com",
    "https://*.analytics.google.com",
    "https://*.googletagmanager.com",
  ],
  "frame-src": [
    "https://*.firebaseapp.com",
    "https://www.google.com/recaptcha/",
    "https://recaptcha.google.com/recaptcha/",
  ],
  "object-src": ["'none'"],
  "base-uri": ["'self'"],
  "form-action": ["'self'"],
  "frame-ancestors": ["'none'"],
};

const cspValue = Object.entries(csp)
  .map(([directive, sources]) => `${directive} ${sources.join(" ")}`)
  .join("; ");

const securityHeaders = [
  // Report-only for now: the browser logs what it would block in the console but blocks nothing.
  // Once a few days of use show nothing real is blocked, rename this to Content-Security-Policy.
  { key: "Content-Security-Policy-Report-Only", value: cspValue },
  // Enforced now. Report-only ignores frame-ancestors, so this is what actually stops framing.
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
  { key: "Strict-Transport-Security", value: "max-age=31536000" },
];

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
