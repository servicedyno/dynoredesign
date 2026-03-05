import { createTheme } from "@mui/material";

declare module "@mui/material/Button" {
  interface ButtonPropsVariantOverrides {
    rounded: true;
    pills: true;
    bluepill: true;
  }
  interface ButtonPropsColorOverrides {
    white: true;
  }
}

declare module "@mui/material/styles" {
  interface Palette {
    border: {
      focus: any;
      main: string;
      success: string;
      error: string;
    };
  }
  interface PaletteOptions {
    border?: {
      main?: string;
      focus?: string;
      success?: string;
      error?: string;
    };
  }
}

export const toolbarHeight = 70;
export const drawerWidth = 64;

const tempTheme = createTheme();
export const theme = createTheme({
  breakpoints: {
    values: {
      xs: 0,
      sm: 600,
      md: 900,
      lg: 1200,
      xl: 1600,
    },
  },
  palette: {
    common: {
      black: "#12131C",
      white: "#fff",
    },
    success: {
      main: "#EAFFF0",
      dark: "#47B464",
      light: "#DCF6E4",
    },
    error: {
      main: "#E8484A",
    },
    border: {
      main: "#E9ECF2",
      focus: "#A3A6AC",
      success: "#1C993D",
      error: "#E8484A",
    },
    primary: {
      main: "#0004FF", //Dark Blue
      dark: "#000000",
      light: "#E5EDFF", //Light Blue
      contrastText: "#fff",
    },
    secondary: {
      main: "#f4f6fa", //background color
      dark: "#E9ECF2",
      light: "#F4F6FA",
      contrastText: "#D9D9D9",
    },
    text: {
      primary: "#242428",
      secondary: "#676768",
      disabled: "#ACACAC",
    },
  },
  typography: {
    fontFamily: "'Urbanist', sans-serif",
    fontWeightLight: 300,
    fontWeightRegular: 500,
    fontWeightMedium: 600,
    fontWeightBold: 700,
    h1: {
      fontFamily: "'Urbanist', sans-serif",
      fontWeight: 700,
      fontSize: "48px",
      lineHeight: 1.15,
      letterSpacing: "-0.02em",
    },
    h2: {
      fontFamily: "'Urbanist', sans-serif",
      fontWeight: 700,
      fontSize: "40px",
      lineHeight: 1.2,
      letterSpacing: "-0.02em",
    },
    h3: {
      fontFamily: "'Urbanist', sans-serif",
      fontWeight: 700,
      fontSize: "32px",
      lineHeight: 1.25,
      letterSpacing: "-0.015em",
    },
    h4: {
      fontFamily: "'Urbanist', sans-serif",
      fontWeight: 600,
      fontSize: "28px",
      lineHeight: 1.3,
    },
    h5: {
      fontFamily: "'Urbanist', sans-serif",
      fontWeight: 600,
      fontSize: "22px",
      lineHeight: 1.35,
    },
    h6: {
      fontFamily: "'Urbanist', sans-serif",
      fontWeight: 600,
      fontSize: "18px",
      lineHeight: 1.4,
    },
    subtitle1: {
      fontFamily: "'Urbanist', sans-serif",
      fontWeight: 500,
      fontSize: "16px",
      lineHeight: 1.5,
    },
    subtitle2: {
      fontFamily: "'Urbanist', sans-serif",
      fontWeight: 600,
      fontSize: "14px",
      lineHeight: 1.45,
    },
    body1: {
      fontFamily: "'Urbanist', sans-serif",
      fontWeight: 400,
      fontSize: "16px",
      lineHeight: 1.6,
    },
    body2: {
      fontFamily: "'Urbanist', sans-serif",
      fontWeight: 400,
      fontSize: "14px",
      lineHeight: 1.6,
    },
    button: {
      fontFamily: "'Urbanist', sans-serif",
      fontWeight: 600,
      fontSize: "16px",
      lineHeight: 1.2,
      textTransform: "none",
    },
    caption: {
      fontFamily: "'Urbanist', sans-serif",
      fontWeight: 500,
      fontSize: "12px",
      lineHeight: 1.4,
    },
    overline: {
      fontFamily: "'Urbanist', sans-serif",
      fontWeight: 700,
      fontSize: "11px",
      letterSpacing: "0.08em",
      textTransform: "uppercase",
    },
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          lineHeight: 1,
        },
      },
      variants: [
        {
          props: { variant: "contained" },
          style: {
            padding: "12px 24px",
          },
        },
        {
          props: { variant: "rounded" },
          style: {
            border: "1px solid",
            color: "#fff",
            padding: "12px 30px",
            background: "#1034A6",
            fontWeight: 400,
            borderRadius: "50px",
            textTransform: "none",
            cursor: "pointer",
            "&:hover": {
              color: "#1034A6",
              background: "#fff",
            },
            "&.Mui-disabled": {
              background: "#1034A688",
              color: "#fff",
              pointerEvents: "auto",
              cursor: "not-allowed",
            },
            "&.MuiButton-roundedSuccess": {
              background: "#2e7d32",
              "&:hover": {
                color: "#2e7d32",
                background: "#fff",
              },
            },
            "&.MuiButton-roundedError": {
              background: "#d32f2f",
              "&:hover": {
                color: "#d32f2f",
                background: "#fff",
              },
            },
            "&.MuiButton-roundedSecondary": {
              background: "#12131C",
              "&:hover": {
                color: "#12131C",
                background: "#fff",
              },
            },
            "&.MuiButton-roundedWhite": {
              background: "#fff",
              color: "#12131C",
              "&:hover": {
                color: "#fff",
                background: "#12131C",
              },
            },
          },
        },
        {
          props: { variant: "pills" },
          style: {
            border: "1px solid",
            padding: "10px 30px",
            color: "#1034A6",
            fontWeight: 600,
            borderRadius: "15px",
            fontSize: "16px",
            "&:hover": {
              color: "#fff",
              background: "#1034A6",
            },
          },
        },
        {
          props: { variant: "bluepill" },
          style: {
            border: "1px solid",
            padding: "10px 30px",
            color: "#fff",
            background: "#1034A6",
            fontWeight: 600,
            borderRadius: "15px",
            fontSize: "16px",
            "&:hover": {
              color: "#1034A6",
              background: "#fff",
            },
            "&.Mui-disabled": {
              background: "#1034A699",
              color: "#fff",
            },
          },
        },
      ],
    },
    MuiIconButton: {
      styleOverrides: {
        root: {
          "&.Mui-disabled": {
            cursor: "not-allowed",
            pointerEvents: "auto",
          },
        },
      },
    },
    MuiInputBase: {
      styleOverrides: {
        root: {
          borderRadius: "20px",
        },
      },
    },
    MuiSelect: {
      defaultProps: {
        MenuProps: {
          PaperProps: {
            sx: {
              maxHeight: "270px",
            },
          },
        },
      },
      styleOverrides: {
        outlined: {
          color: "#1034A6",
          padding: "10px 15px",
          borderRadius: "20px",
          [tempTheme.breakpoints.down("md")]: {
            minWidth: "75px",
          },
          border: "1px solid ",
        },
      },
    },
    MuiToolbar: {
      styleOverrides: {
        root: {
          minHeight: `${toolbarHeight}px !important`,
          alignItems: "center",
        },
      },
    },
    MuiDialogTitle: {
      styleOverrides: {
        root: {
          fontSize: "30px",
          fontWeight: 600,
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          "& .MuiOutlinedInput-root": {
            background: "#F8F8F8",
          },

          borderRadius: "20px",
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          "& .MuiChip-label": {
            paddingLeft: "4px",
            paddingRight: "8px",
          },
        },
      },
    },
  },
});
