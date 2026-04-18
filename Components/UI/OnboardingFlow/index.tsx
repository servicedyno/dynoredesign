import { CompanyAction, WalletAction } from "@/Redux/Actions";
import { COMPANY_FETCH } from "@/Redux/Actions/CompanyAction";
import { WALLET_FETCH } from "@/Redux/Actions/WalletAction";
import { rootReducer } from "@/utils/types";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import CreateCompanyModal from "./CreateCompanyModal";
import AddWalletModal from "@/Components/UI/AddWalletModal";
import CelebrationOverlay from "./CelebrationOverlay";
import StepIndicator from "./StepIndicator";

type OnboardingPhase = "loading" | "company" | "wallet" | "celebration" | "done";

const ONBOARDING_DISMISSED_KEY = "onboarding_dismissed";

const OnboardingFlow: React.FC = () => {
  const dispatch = useDispatch();
  const [phase, setPhase] = useState<OnboardingPhase>("loading");
  const decisionMade = useRef(false);
  const loadingSeenTrue = useRef(false);

  const companyState = useSelector(
    (state: rootReducer) => state.companyReducer,
  );
  const walletState = useSelector((state: rootReducer) => state.walletReducer);

  const companyList = companyState.companyList ?? [];
  const walletList = walletState.walletList ?? [];
  const hasCompany = companyList.length > 0;
  const hasWallet = walletList.length > 0;
  const isLoading = companyState.loading || walletState.loading;

  // Fetch data once on mount
  useEffect(() => {
    dispatch(CompanyAction(COMPANY_FETCH));
    dispatch(WalletAction(WALLET_FETCH));
  }, [dispatch]);

  // Track when loading has been true at least once (meaning dispatches were processed)
  useEffect(() => {
    if (isLoading) {
      loadingSeenTrue.current = true;
    }
  }, [isLoading]);

  // Make phase decision only AFTER loading has been true AND then returned to false
  // This ensures we wait for actual data fetches, not just the initial empty state
  useEffect(() => {
    if (decisionMade.current) return;

    // Wait until loading was true at least once (dispatches processed)
    if (!loadingSeenTrue.current) return;

    // Wait until loading is done
    if (isLoading) return;

    // Now data has actually been fetched
    decisionMade.current = true;

    // If user previously dismissed onboarding this session, skip
    if (typeof window !== "undefined" && sessionStorage.getItem(ONBOARDING_DISMISSED_KEY)) {
      setPhase("done");
      return;
    }

    if (!hasCompany) {
      setPhase("company");
    } else if (!hasWallet) {
      setPhase("wallet");
    } else {
      setPhase("done");
    }
  }, [isLoading, hasCompany, hasWallet]);

  // Auto-dismiss wallet modal if wallet data arrives late
  useEffect(() => {
    if (phase === "wallet" && hasWallet) {
      setPhase("done");
    }
  }, [hasWallet, phase]);

  // Called when company creation succeeds
  const handleCompanyCreated = useCallback(() => {
    dispatch(WalletAction(WALLET_FETCH));
    setPhase("wallet");
  }, [dispatch]);

  // Called when wallet is successfully added
  const handleWalletAdded = useCallback(() => {
    dispatch(WalletAction(WALLET_FETCH));
    // Clear dismissal flag since user completed onboarding
    if (typeof window !== "undefined") {
      sessionStorage.removeItem(ONBOARDING_DISMISSED_KEY);
    }
    setPhase("celebration");
  }, [dispatch]);

  // Called when celebration is dismissed
  const handleCelebrationDismiss = useCallback(() => {
    setPhase("done");
  }, []);

  // Called when user skips onboarding ("I'll do this later")
  const handleSkipOnboarding = useCallback(() => {
    if (typeof window !== "undefined") {
      sessionStorage.setItem(ONBOARDING_DISMISSED_KEY, "1");
    }
    setPhase("done");
  }, []);

  // Don't render anything for returning users or during loading
  if (phase === "done" || phase === "loading") return null;

  return (
    <>
      <CreateCompanyModal
        open={phase === "company"}
        onSuccess={handleCompanyCreated}
        onClose={handleSkipOnboarding}
      />

      <AddWalletModal
        open={phase === "wallet"}
        onClose={handleSkipOnboarding}
        onWalletAdded={handleWalletAdded}
        headerExtra={<StepIndicator currentStep={2} totalSteps={2} />}
      />

      <CelebrationOverlay
        open={phase === "celebration"}
        onDismiss={handleCelebrationDismiss}
      />
    </>
  );
};

export default OnboardingFlow;
