import useIsMobile from "@/hooks/useIsMobile";
import {
  Box,
  Dialog,
  Slide,
  Typography,
  useTheme,
} from "@mui/material";
import { TransitionProps } from "@mui/material/transitions";
import React, { useCallback, useEffect } from "react";
import confetti from "canvas-confetti";
import { CelebrationRounded } from "@mui/icons-material";
import CustomButton from "@/Components/UI/Buttons";

const Transition = React.forwardRef(function Transition(
  props: TransitionProps & { children: React.ReactElement<any, any> },
  ref: React.Ref<unknown>,
) {
  return <Slide direction="up" ref={ref} {...props} />;
});

interface CelebrationOverlayProps {
  open: boolean;
  onDismiss: () => void;
}

const CelebrationOverlay: React.FC<CelebrationOverlayProps> = ({
  open,
  onDismiss,
}) => {
  const theme = useTheme();
  const isMobile = useIsMobile("sm");

  const fireConfetti = useCallback(() => {
    const duration = 2500;
    const end = Date.now() + duration;

    const burst = () => {
      confetti({
        particleCount: 3,
        angle: 60,
        spread: 55,
        origin: { x: 0, y: 0.65 },
        colors: ["#0004FF", "#1C993D", "#E5EDFF", "#47B464", "#FFD700"],
      });
      confetti({
        particleCount: 3,
        angle: 120,
        spread: 55,
        origin: { x: 1, y: 0.65 },
        colors: ["#0004FF", "#1C993D", "#E5EDFF", "#47B464", "#FFD700"],
      });
      if (Date.now() < end) requestAnimationFrame(burst);
    };

    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
      colors: ["#0004FF", "#1C993D", "#E5EDFF", "#47B464", "#FFD700"],
    });

    burst();
  }, []);

  useEffect(() => {
    if (open) {
      // Small delay so the dialog is visible before confetti fires
      const timer = setTimeout(() => fireConfetti(), 300);
      const autoDismiss = setTimeout(() => onDismiss(), 6000);
      return () => {
        clearTimeout(timer);
        clearTimeout(autoDismiss);
      };
    }
  }, [open, fireConfetti, onDismiss]);

  return (
    <Dialog
      open={open}
      TransitionComponent={Transition}
      maxWidth="sm"
      PaperProps={{
        sx: {
          borderRadius: "20px",
          overflow: "visible",
          maxWidth: isMobile ? "90vw" : "440px",
          mx: "auto",
          textAlign: "center",
          p: isMobile ? 3 : 4,
          backgroundColor: "#fff",
        },
      }}
      data-testid="onboarding-celebration-modal"
    >
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 1.5,
        }}
      >
        <Box
          sx={{
            width: isMobile ? 64 : 80,
            height: isMobile ? 64 : 80,
            borderRadius: "50%",
            background: `linear-gradient(135deg, ${theme.palette.primary.light || "#E5EDFF"} 0%, ${theme.palette.success.light || "#E8F5E9"} 100%)`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            animation: "celebrationBounce 0.8s ease-out",
            "@keyframes celebrationBounce": {
              "0%": { transform: "scale(0) rotate(-180deg)" },
              "60%": { transform: "scale(1.2) rotate(10deg)" },
              "100%": { transform: "scale(1) rotate(0deg)" },
            },
          }}
        >
          <CelebrationRounded
            sx={{
              fontSize: isMobile ? 30 : 38,
              color: theme.palette.primary.main,
            }}
          />
        </Box>

        <Typography
          data-testid="celebration-title"
          sx={{
            fontSize: isMobile ? "22px" : "28px",
            fontFamily: "UrbanistSemibold",
            fontWeight: 700,
            color: theme.palette.text.primary,
            lineHeight: 1.2,
            animation: "celebrationFadeIn 0.6s ease-out 0.3s both",
            "@keyframes celebrationFadeIn": {
              "0%": { opacity: 0, transform: "translateY(10px)" },
              "100%": { opacity: 1, transform: "translateY(0)" },
            },
          }}
        >
          You're all set!
        </Typography>

        <Typography
          sx={{
            fontSize: isMobile ? "13px" : "15px",
            fontFamily: "UrbanistMedium",
            fontWeight: 500,
            color: theme.palette.text.secondary,
            lineHeight: 1.5,
            maxWidth: "320px",
            animation: "celebrationFadeIn 0.6s ease-out 0.5s both",
          }}
        >
          Your company and wallet are configured. You're ready to start
          accepting crypto payments!
        </Typography>

        <Box
          sx={{
            mt: 1,
            animation: "celebrationFadeIn 0.6s ease-out 0.7s both",
          }}
        >
          <CustomButton
            data-testid="celebration-dismiss-btn"
            label="Go to Dashboard"
            variant="primary"
            size={isMobile ? "small" : "medium"}
            onClick={onDismiss}
            sx={{ px: 4 }}
          />
        </Box>
      </Box>
    </Dialog>
  );
};

export default CelebrationOverlay;
