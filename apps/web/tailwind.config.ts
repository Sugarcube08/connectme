import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "../../packages/design-tokens/src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        obsidian: {
          DEFAULT: "#0B0B10",
          surface: "#13121C",
          elevated: "#1C1A29",
          border: "#2F2B48",
          muted: "#181624",
        },
        royalViolet: {
          DEFAULT: "#6D3CE8",
          hover: "#7E4DF5",
          active: "#5B2ECE",
          muted: "rgba(109, 60, 232, 0.15)",
          glow: "rgba(109, 60, 232, 0.35)",
        },
        deepIndigo: {
          DEFAULT: "#252044",
          surface: "#1B1735",
          border: "#362E5F",
          light: "#312B58",
        },
        warmIvory: {
          DEFAULT: "#F3EFE7",
          dimmed: "#D8D3C8",
          muted: "#B2ADA2",
        },
        metallicGold: {
          DEFAULT: "#C8A96B",
          hover: "#D6BA81",
          muted: "rgba(200, 169, 107, 0.2)",
          accent: "#DFBA72",
        },
        slate: {
          DEFAULT: "#777681",
          dark: "#4E4C59",
          light: "#A5A4B2",
          border: "#302E3B",
        },
      },
      fontFamily: {
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          '"Segoe UI"',
          "Roboto",
          "Helvetica",
          "Arial",
          "sans-serif",
        ],
        display: [
          '"Cinzel"',
          '"Playfair Display"',
          "-apple-system",
          "BlinkMacSystemFont",
          '"Segoe UI"',
          "serif",
        ],
        mono: [
          '"JetBrains Mono"',
          '"Fira Code"',
          "ui-monospace",
          "SFMono-Regular",
          "monospace",
        ],
      },
      boxShadow: {
        royal: "0 0 25px -5px rgba(109, 60, 232, 0.3)",
        "royal-lg": "0 0 40px -10px rgba(109, 60, 232, 0.45)",
        gold: "0 0 20px -5px rgba(200, 169, 107, 0.3)",
      },
      backgroundImage: {
        "devcon-mesh":
          "radial-gradient(ellipse at 50% 0%, rgba(109, 60, 232, 0.18) 0%, rgba(37, 32, 68, 0.08) 50%, rgba(11, 11, 16, 0) 100%)",
        "gold-shimmer":
          "linear-gradient(135deg, rgba(200, 169, 107, 0.2) 0%, rgba(200, 169, 107, 0.05) 100%)",
      },
    },
  },
  plugins: [],
};

export default config;
