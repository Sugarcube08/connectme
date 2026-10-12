export const colors = {
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
  status: {
    success: "#34D399",
    warning: "#FBBF24",
    danger: "#F87171",
    info: "#60A5FA",
  },
} as const;

export const typography = {
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
} as const;

export const tokens = {
  colors,
  typography,
} as const;

export type Colors = typeof colors;
export type Typography = typeof typography;
