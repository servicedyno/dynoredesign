import React, { useState } from "react";
import { Box, Button, Typography } from "@mui/material";
import {
  BusinessRounded,
  AccountBalanceWalletRounded,
  LinkRounded,
} from "@mui/icons-material";
import OnboardingChecklist, {
  ChecklistStep,
} from "@/Components/UI/OnboardingFlow/OnboardingChecklist";
import CelebrationOverlay from "@/Components/UI/OnboardingFlow/CelebrationOverlay";

/**
 * TEMPORARY preview page for verifying onboarding UI visuals
 * (checklist done/next/locked states + celebration CTA) without
 * needing a live merchant account. Safe to delete after testing.
 */
const OnboardingPreview: React.FC = () => {
  const [celebrate, setCelebrate] = useState(false);

  const steps: ChecklistStep[] = [
    {
      key: "company",
      label: "Create your company",
      description: "Add your business details",
      icon: BusinessRounded,
      done: true,
      onClick: () => {},
    },
    {
      key: "wallet",
      label: "Add a payout wallet",
      description: "Required — funds are forwarded here",
      icon: AccountBalanceWalletRounded,
      done: false,
      onClick: () => {},
    },
    {
      key: "link",
      label: "Create your first payment link",
      description: "Start getting paid in seconds",
      icon: LinkRounded,
      done: false,
      onClick: () => {},
    },
  ];

  return (
    <Box sx={{ maxWidth: 640, mx: "auto", p: 4 }}>
      <Typography variant="h5" sx={{ mb: 3, fontFamily: "UrbanistSemibold" }}>
        Onboarding Preview
      </Typography>

      <OnboardingChecklist steps={steps} />

      <Button
        data-testid="preview-show-celebration"
        variant="contained"
        sx={{ mt: 3 }}
        onClick={() => setCelebrate(true)}
      >
        Show celebration
      </Button>

      <CelebrationOverlay open={celebrate} onDismiss={() => setCelebrate(false)} />
    </Box>
  );
};

export default OnboardingPreview;
