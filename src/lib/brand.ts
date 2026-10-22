/**
 * EnCare Brand Configuration
 *
 * Centralized brand values for the EnCare platform.
 * Update these values to change branding across the application.
 */

export const brand = {
  // Platform identity
  name: "EnCare",
  tagline: "Care, connected.",
  description: "Modern care management for exceptional teams.",

  // Legal/formal name
  legalName: "EnCare",

  // URLs (update for production)
  supportUrl: "https://encif.com/support",
  privacyUrl: "/privacy",
  termsUrl: "/terms",

  // Colors (hex values for use in inline styles and emails)
  colors: {
    // Premium Care palette
    midnight: "#182F42",     // Primary dark / navigation
    teal: "#237E78",         // Signature brand color
    gold: "#E3AD63",         // Accent / highlights
    ivory: "#FAF8F3",        // Background
    white: "#FFFFFF",

    // Semantic aliases
    primary: "#237E78",      // Teal
    secondary: "#182F42",    // Midnight
    accent: "#E3AD63",       // Gold
    background: "#FAF8F3",   // Ivory

    // Status colors (preserve semantic meaning)
    success: "#059669",      // Emerald-600
    warning: "#D97706",      // Amber-600
    error: "#DC2626",        // Red-600
    info: "#0EA5E9",         // Sky-500
  },

  // Typography
  fonts: {
    sans: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    mono: "'JetBrains Mono', 'Fira Code', 'Consolas', monospace",
  },

  // Email configuration
  email: {
    // Keep existing sender unless separately verified
    defaultFrom: process.env.EMAIL_FROM ?? "noreply@encif.com",
  },
} as const;

// Type for brand colors
export type BrandColor = keyof typeof brand.colors;

// Helper to get brand color
export function getBrandColor(color: BrandColor): string {
  return brand.colors[color];
}
