/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            /* ── Semantic Color Tokens ──────────────────── */
            colors: {
                primary: "#0EA5E9",   // sky-500
                "surface-dark": "#0F172A",   // slate-900
                "surface-light": "#F8FAFC",  // slate-50
                success: "#10B981",   // emerald-500
                error: "#E11D48",   // rose-600
                warning: "#F59E0B",   // amber-500

                slate: {
                    50: "#F8FAFC",
                    100: "#F1F5F9",
                    200: "#E2E8F0",
                    300: "#CBD5E1",
                    400: "#94A3B8",
                    500: "#64748B",
                    600: "#475569",
                    700: "#334155",
                    800: "#1E293B",
                    900: "#0F172A",
                    950: "#020617",
                },
                sky: {
                    400: "#38BDF8",
                    500: "#0EA5E9",
                    600: "#0284C7",
                },
                emerald: {
                    400: "#34D399",
                    500: "#10B981",
                },
                rose: {
                    400: "#FB7185",
                    600: "#E11D48",
                },
                amber: {
                    400: "#FBBF24",
                    500: "#F59E0B",
                },
            },

            /* ── Elevation Radii ───────────────────────── */
            borderRadius: {
                "4xl": "3rem",    // 48px — standard cards
                "3xl": "1.5rem",  // 24px — buttons / inputs
                "2xl": "1rem",    // 16px — chips / badges
            },

            /* ── Typography ────────────────────────────── */
            fontFamily: {
                inter: ["Inter", "system-ui", "sans-serif"],
                mono: ["JetBrains Mono", "monospace"],
            },

            /* ── Page Transition Animation ─────────────── */
            keyframes: {
                "animate-in": {
                    "0%": { opacity: "0", transform: "translateY(16px)" },
                    "100%": { opacity: "1", transform: "translateY(0)" },
                },
                "fade-in": {
                    "0%": { opacity: "0" },
                    "100%": { opacity: "1" },
                },
                "slide-in-from-bottom": {
                    "0%": { transform: "translateY(1rem)" },
                    "100%": { transform: "translateY(0)" },
                },
                "collapse-in": {
                    "0%": { width: "16rem" },
                    "100%": { width: "4.5rem" },
                },
                "collapse-out": {
                    "0%": { width: "4.5rem" },
                    "100%": { width: "16rem" },
                },
            },
            animation: {
                "page-in": "animate-in 700ms cubic-bezier(0.4, 0, 0.2, 1) both",
                "fade-in": "fade-in 500ms cubic-bezier(0.4, 0, 0.2, 1) both",
                "slide-up": "slide-in-from-bottom 700ms cubic-bezier(0.4, 0, 0.2, 1) both",
            },

            /* ── Layout ────────────────────────────────── */
            spacing: {
                "sidebar": "16rem",    // 256px expanded
                "sidebar-c": "4.5rem",   // 72px collapsed
            },
        },
    },
    plugins: [],
};
