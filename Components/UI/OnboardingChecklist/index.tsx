import { CompanyAction } from "@/Redux/Actions";
import { COMPANY_FETCH } from "@/Redux/Actions/CompanyAction";
import { WalletAction } from "@/Redux/Actions";
import { WALLET_FETCH } from "@/Redux/Actions/WalletAction";
import { rootReducer } from "@/utils/types";
import {
  Box,
  Typography,
  useTheme,
  LinearProgress,
  linearProgressClasses,
} from "@mui/material";
import {
  CheckCircleRounded,
  ArrowForwardRounded,
  BusinessRounded,
  AccountBalanceWalletRounded,
  LinkRounded,
  CelebrationRounded,
} from "@mui/icons-material";
import { useRouter } from "next/router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import useIsMobile from "@/hooks/useIsMobile";
import confetti from "canvas-confetti";

const CELEBRATION_DURATION = 5000;

const OnboardingChecklist = () => {
  const theme = useTheme();
  const router = useRouter();
  const dispatch = useDispatch();
  const isMobile = useIsMobile("md");
  const [dismissed, setDismissed] = useState(false);
  const [fetched, setFetched] = useState(false);
  const [celebrating, setCelebrating] = useState(false);
  const prevSetupDone = useRef(false);

  const companyState = useSelector(
    (state: rootReducer) => state.companyReducer,
  );
  const walletState = useSelector((state: rootReducer) => state.walletReducer);

  useEffect(() => {
    dispatch(CompanyAction(COMPANY_FETCH));
    dispatch(WalletAction(WALLET_FETCH));
    setFetched(true);
  }, [dispatch]);

  const hasCompany = companyState.companyList?.length > 0;
  const hasWallet = walletState.walletList?.length > 0;
  const allPrerequisitesDone = hasCompany && hasWallet;

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

    // Initial big burst
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
      colors: ["#0004FF", "#1C993D", "#E5EDFF", "#47B464", "#FFD700"],
    });

    burst();
  }, []);

  // Detect transition from incomplete -> complete
  useEffect(() => {
    if (fetched && allPrerequisitesDone && !prevSetupDone.current) {
      // Only celebrate if we had previously loaded incomplete state
      if (prevSetupDone.current === false && fetched) {
        setCelebrating(true);
        fireConfetti();

        const timer = setTimeout(() => {
          setCelebrating(false);
          setDismissed(true);
        }, CELEBRATION_DURATION);

        return () => clearTimeout(timer);
      }
    }
    prevSetupDone.current = allPrerequisitesDone;
  }, [allPrerequisitesDone, fetched, fireConfetti]);

  const steps = useMemo(
    () => [
      {
        key: "company",
        label: "Create a Company",
        description: "Set up your business profile to start accepting payments",
        done: hasCompany,
        icon: BusinessRounded,
        action: () => router.push("/company"),
        actionLabel: "Create Company",
      },
      {
        key: "wallet",
        label: "Add a Wallet",
        description: "Add a crypto wallet address to receive payments",
        done: hasWallet,
        icon: AccountBalanceWalletRounded,
        action: () => router.push("/wallet"),
        actionLabel: "Add Wallet",
      },
      {
        key: "payment",
        label: "Create a Payment Link",
        description: "Generate your first payment link and start collecting",
        done: false,
        icon: LinkRounded,
        action: () => router.push("/create-pay-link"),
        actionLabel: "Create Payment",
        disabled: !hasCompany || !hasWallet,
      },
    ],
    [hasCompany, hasWallet, router],
  );

  const completedCount = steps.filter((s) => s.done).length;
  const progress = (completedCount / steps.length) * 100;

  // Show celebration state
  if (celebrating) {
    return (
      <Box
        data-testid="onboarding-celebration"
        sx={{
          mb: { xs: 2, md: 2.5 },
          mx: { xs: "16px", md: 0 },
          borderRadius: "14px",
          border: `1px solid ${theme.palette.border.success}`,
          backgroundColor: theme.palette.success.main,
          overflow: "hidden",
          p: isMobile ? 3 : 4,
          textAlign: "center",
          animation: "celebrationPulse 0.6s ease-out",
          "@keyframes celebrationPulse": {
            "0%": { transform: "scale(0.95)", opacity: 0.7 },
            "50%": { transform: "scale(1.02)" },
            "100%": { transform: "scale(1)", opacity: 1 },
          },
        }}
      >
        <Box
          sx={{
            width: isMobile ? 56 : 72,
            height: isMobile ? 56 : 72,
            borderRadius: "50%",
            backgroundColor: theme.palette.success.light,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            mx: "auto",
            mb: 2,
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
              fontSize: isMobile ? 28 : 36,
              color: theme.palette.border.success,
            }}
          />
        </Box>
        <Typography
          data-testid="celebration-title"
          sx={{
            fontSize: isMobile ? "20px" : "26px",
            fontFamily: "UrbanistSemibold",
            fontWeight: 700,
            color: theme.palette.text.primary,
            lineHeight: 1.3,
            mb: 0.5,
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
          }}
        >
          Your account is fully configured. Start creating payment links now!
        </Typography>
      </Box>
    );
  }

  // Don't show if everything is done or dismissed, or still loading
  if (dismissed || (allPrerequisitesDone && fetched)) return null;
  if (!fetched || (companyState.loading && walletState.loading)) return null;

  return (
    <Box
      data-testid="onboarding-checklist"
      sx={{
        mb: { xs: 2, md: 2.5 },
        mx: { xs: "16px", md: 0 },
        borderRadius: "14px",
        border: `1px solid ${theme.palette.border.main}`,
        backgroundColor: "#fff",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <Box
        sx={{
          px: isMobile ? 2 : 3,
          pt: isMobile ? 2 : 2.5,
          pb: isMobile ? 1.5 : 2,
        }}
      >
        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
          }}
        >
          <Box>
            <Typography
              data-testid="onboarding-title"
              sx={{
                fontSize: isMobile ? "16px" : "20px",
                fontFamily: "UrbanistSemibold",
                fontWeight: 600,
                color: theme.palette.text.primary,
                lineHeight: 1.3,
              }}
            >
              Complete your setup
            </Typography>
            <Typography
              sx={{
                fontSize: isMobile ? "12px" : "14px",
                fontFamily: "UrbanistMedium",
                fontWeight: 500,
                color: theme.palette.text.secondary,
                mt: 0.5,
                lineHeight: 1.4,
              }}
            >
              {completedCount} of {steps.length} steps completed
            </Typography>
          </Box>
        </Box>

        {/* Progress Bar */}
        <LinearProgress
          data-testid="onboarding-progress"
          variant="determinate"
          value={progress}
          sx={{
            mt: 1.5,
            height: 6,
            borderRadius: 3,
            [`&.${linearProgressClasses.colorPrimary}`]: {
              backgroundColor: theme.palette.secondary.dark,
            },
            [`& .${linearProgressClasses.bar}`]: {
              borderRadius: 3,
              backgroundColor: theme.palette.border.success,
            },
          }}
        />
      </Box>

      {/* Steps */}
      <Box sx={{ px: isMobile ? 1 : 1.5, pb: isMobile ? 1 : 1.5 }}>
        {steps.map((step, index) => {
          const isDisabled = "disabled" in step && step.disabled;
          const Icon = step.icon;

          return (
            <Box
              key={step.key}
              data-testid={`onboarding-step-${step.key}`}
              onClick={() => {
                if (!step.done && !isDisabled) step.action();
              }}
              sx={{
                display: "flex",
                alignItems: "center",
                gap: isMobile ? 1.5 : 2,
                px: isMobile ? 1.5 : 2,
                py: isMobile ? 1.5 : 1.75,
                borderRadius: "10px",
                cursor: step.done || isDisabled ? "default" : "pointer",
                opacity: isDisabled ? 0.5 : 1,
                transition: "background-color 0.15s ease",
                "&:hover": {
                  backgroundColor:
                    step.done || isDisabled
                      ? "transparent"
                      : theme.palette.secondary.main,
                },
              }}
            >
              {/* Status Icon */}
              {step.done ? (
                <CheckCircleRounded
                  data-testid={`onboarding-step-${step.key}-check`}
                  sx={{
                    fontSize: isMobile ? 22 : 26,
                    color: theme.palette.border.success,
                    flexShrink: 0,
                  }}
                />
              ) : (
                <Box
                  sx={{
                    width: isMobile ? 22 : 26,
                    height: isMobile ? 22 : 26,
                    borderRadius: "50%",
                    border: `2px solid ${isDisabled ? theme.palette.border.main : theme.palette.primary.main}`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <Typography
                    sx={{
                      fontSize: isMobile ? "11px" : "13px",
                      fontFamily: "UrbanistSemibold",
                      fontWeight: 700,
                      color: isDisabled
                        ? theme.palette.text.disabled
                        : theme.palette.primary.main,
                      lineHeight: 1,
                    }}
                  >
                    {index + 1}
                  </Typography>
                </Box>
              )}

              {/* Step Icon */}
              <Box
                sx={{
                  width: isMobile ? 36 : 42,
                  height: isMobile ? 36 : 42,
                  borderRadius: "10px",
                  backgroundColor: step.done
                    ? theme.palette.success.main
                    : theme.palette.primary.light,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <Icon
                  sx={{
                    fontSize: isMobile ? 18 : 22,
                    color: step.done
                      ? theme.palette.border.success
                      : theme.palette.primary.main,
                  }}
                />
              </Box>

              {/* Text */}
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography
                  sx={{
                    fontSize: isMobile ? "13px" : "15px",
                    fontFamily: "UrbanistSemibold",
                    fontWeight: 600,
                    color: step.done
                      ? theme.palette.text.secondary
                      : theme.palette.text.primary,
                    textDecoration: step.done ? "line-through" : "none",
                    lineHeight: 1.3,
                  }}
                >
                  {step.label}
                </Typography>
                {!isMobile && (
                  <Typography
                    sx={{
                      fontSize: "12px",
                      fontFamily: "UrbanistMedium",
                      fontWeight: 500,
                      color: theme.palette.text.secondary,
                      lineHeight: 1.3,
                      mt: 0.25,
                    }}
                  >
                    {step.description}
                  </Typography>
                )}
              </Box>

              {/* Arrow */}
              {!step.done && !isDisabled && (
                <ArrowForwardRounded
                  sx={{
                    fontSize: isMobile ? 18 : 20,
                    color: theme.palette.primary.main,
                    flexShrink: 0,
                  }}
                />
              )}
            </Box>
          );
        })}
      </Box>
    </Box>
  );
};

export default OnboardingChecklist;
