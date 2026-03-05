import { Box, IconButton, styled } from "@mui/material";

export const ModalBackdrop = styled(Box)<{ open: boolean }>(({ open }) => ({
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.3)",
    backdropFilter: open ? "blur(4px)" : "none",
    opacity: open ? 1 : 0,
    pointerEvents: open ? "auto" : "none",
    transition: "all 0.25s ease",
    zIndex: 1199,
    borderRadius: "30px",
  }));
  
  export const ModalContainer = styled(Box)({
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1200,
    pointerEvents: "none",
  });
  
  export const ModalWrapper = styled(Box)<{ open: boolean }>(({ theme, open }) => ({
    position: "relative",
    width: "fit-content",
    minWidth: "fit-content",
    background: theme.palette.common.white,
    borderRadius: "12px",
    boxShadow: "0 4px 20px rgba(0,0,0,0.1)",
    overflow: "hidden",
    padding: "6px",
    opacity: open ? 1 : 0,
    pointerEvents: open ? "auto" : "none",
    transform: open ? "scale(1)" : "scale(0.95)",
    transition: "all 0.25s ease",
  }));
  
  export const CloseButton = styled(IconButton)(({ theme }) => ({
    position: "absolute",
    top: "8px",
    right: "8px",
    width: "32px",
    height: "32px",
    backgroundColor: "#F5F5F5",
    color: "#666",
    zIndex: 1,
    "&:hover": {
      backgroundColor: "#E0E0E0",
    },
  }));
  export const CustomLangFlag = styled("img")({
    width: "16px",
    height: "16px",
    borderRadius: "50%",
  });