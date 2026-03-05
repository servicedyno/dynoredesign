import { theme } from "@/styles/theme";
import { Box, styled } from "@mui/material";

// HomeLayout
export const MainBox = styled(Box)(() => ({
  minHeight: "100vh",
  display: "flex",
  flexDirection: "column",
  bgcolor: theme.palette.common.white,
}));

export const MainSection = styled(Box)(() => ({
  flex: 1,
  display: "flex",
  flexDirection: "column",
}));
