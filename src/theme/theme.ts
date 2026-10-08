export const palettes = {
  light: {
    background: "#F7F8FA",
    surface: "#FFFFFF",
    text: "#192323",
    muted: "#5F6E6C",
    line: "#DCE4E1",
    accent: "#236F5B",
    accentText: "#FFFFFF",
    danger: "#B63838",
  },
  dark: {
    background: "#151B1D",
    surface: "#20292B",
    text: "#EFF5F2",
    muted: "#A5B5B0",
    line: "#3B4A47",
    accent: "#93D6B9",
    accentText: "#11271E",
    danger: "#FF9D9D",
  },
};
export type Palette = typeof palettes.light;
export const spacing = { small: 8, medium: 16, large: 24 };
export const radius = { card: 12, input: 8 };
export const typography = { title: 30, body: 16, caption: 13 };
