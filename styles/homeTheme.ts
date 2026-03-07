import { createTheme } from "@mui/material";

export const homeTheme = createTheme({
  palette: {
    mode: "light",
    primary: {
      main: "#0004FF",
      light: "#6A4DFF",
    },
    success: {
      main: "#16A34A",
    },
    text: {
      primary: "#131520",
      secondary: "#676B7E",
    },
    background: {
      default: "#F2F3F8",
      paper: "#FFFFFF",
    },
    border: {
      main: "#E7E8EF",
    },
  },
});

export const homeThemeDark = createTheme({
  palette: {
    mode: "dark",
    primary: {
      main: "#6A7BFF",
      light: "#8E9AFF",
    },
    success: {
      main: "#22C55E",
    },
    text: {
      primary: "#F0F0F5",
      secondary: "#A0A3B5",
    },
    background: {
      default: "#0B0D17",
      paper: "#141625",
    },
    border: {
      main: "#2A2D42",
    },
  },
});
