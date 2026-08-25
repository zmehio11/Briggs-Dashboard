import type { Config } from "tailwindcss";

// Colors follow the dataviz skill's validated default palette
// (references/palette.md) -- categorical hues are assigned in fixed order
// by chart, never cycled arbitrarily. See src/lib/theme.ts for the same
// values exposed to chart components.
const config: Config = {
  darkMode: ["class"],
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        surface: {
          DEFAULT: "#fcfcfb",
          dark: "#1a1a19",
        },
        plane: {
          DEFAULT: "#f9f9f7",
          dark: "#0d0d0d",
        },
        ink: {
          DEFAULT: "#0b0b0b",
          secondary: "#52514e",
          muted: "#898781",
          dark: "#ffffff",
          "dark-secondary": "#c3c2b7",
        },
        hairline: {
          DEFAULT: "#e1e0d9",
          dark: "#2c2c2a",
        },
        status: {
          good: "#0ca30c",
          warning: "#fab219",
          serious: "#ec835a",
          critical: "#d03b3b",
        },
        series: {
          1: "#2a78d6",
          2: "#eb6834",
          3: "#1baf7a",
          4: "#eda100",
          5: "#e87ba4",
          6: "#008300",
          7: "#4a3aa7",
          8: "#e34948",
        },
      },
      fontFamily: {
        sans: ["system-ui", "-apple-system", "Segoe UI", "sans-serif"],
      },
    },
  },
  plugins: [],
};
export default config;
