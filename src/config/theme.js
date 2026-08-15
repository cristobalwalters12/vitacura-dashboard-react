export const THEME_STORAGE_KEY = "lyngus-halo-theme";

export const THEME_PALETTES = {
  light: {
    secondary: "#006970",
    onSecondary: "#FFFFFF",
    secondarySoft: "#7DF4FF",
    secondaryAlpha: "rgba(0, 105, 112, .28)",
    secondaryFade: "rgba(0, 105, 112, 0)",
    primaryContainer: "#131B2E",
    surface: "#E6E8EA",
    onSurface: "#191C1E",
    onSurfaceVariant: "#45464D",
    outline: "#C6C6CD",
    grid: "rgba(69, 70, 77, .16)",
    error: "#BA1A1A",
    success: "#10B981",
    warning: "#F59E0B",
    dataBlue: "#35618D",
    dataViolet: "#6750A4",
  },
  dark: {
    secondary: "#00EEFC",
    onSecondary: "#00383B",
    secondarySoft: "#00383B",
    secondaryAlpha: "rgba(0, 238, 252, .28)",
    secondaryFade: "rgba(0, 238, 252, 0)",
    primaryContainer: "#1B2847",
    surface: "#0F1214",
    onSurface: "#E1E3E5",
    onSurfaceVariant: "#C0C4CC",
    outline: "#45494D",
    grid: "rgba(192, 196, 204, .14)",
    error: "#FFB4AB",
    success: "#34D399",
    warning: "#FBBF24",
    dataBlue: "#8ECAFF",
    dataViolet: "#C4B5FD",
  },
};

export function getThemePalette(theme) {
  return THEME_PALETTES[theme] ?? THEME_PALETTES.dark;
}
