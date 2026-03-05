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

const OnboardingFlow: React.FC = () => {
  const dispatch = useDispatch();
  const [phase, setPhase] = useState<OnboardingPhase>("loading");
  const initialCheckDone = useRef(false);

  const companyState = useSelector(
    (state: rootReducer) => state.companyReducer,
  );
  const walletState = useSelector((state: rootReducer) => state.walletReducer);

  const hasCompany = companyState.companyList?.length > 0;
  const hasWallet = walletState.walletList?.length > 0;
  const isLoading = companyState.loading || walletState.loading;

  // Fetch data on mount
  useEffect(() => {
    dispatch(CompanyAction(COMPANY_FETCH));
    dispatch(WalletAction(WALLET_FETCH));
  }, [dispatch]);

  // Determine initial phase once data loads
  useEffect(() => {
    if (initialCheckDone.current) return;
    if (isLoading) return;

    // Data has loaded at least once
    initialCheckDone.current = true;

    if (!hasCompany) {
      setPhase("company");
    } else if (!hasWallet) {
      setPhase("wallet");
    } else {
      // Returning user — everything set up, skip onboarding
      setPhase("done");
    }
  }, [isLoading, hasCompany, hasWallet]);

  // Called when company creation succeeds
  const handleCompanyCreated = useCallback(() => {
    // Refresh wallet data and move to wallet step
    dispatch(WalletAction(WALLET_FETCH));
    setPhase("wallet");
  }, [dispatch]);

  // Called when wallet is successfully added
  const handleWalletAdded = useCallback(() => {
    // Refresh wallet list to update Redux state
    dispatch(WalletAction(WALLET_FETCH));
    setPhase("celebration");
  }, [dispatch]);

  // Called when celebration is dismissed
  const handleCelebrationDismiss = useCallback(() => {
    setPhase("done");
  }, []);

  // Don't render anything for returning users or during loading
  if (phase === "done" || phase === "loading") return null;

  return (
    <>
      <CreateCompanyModal
        open={phase === "company"}
        onSuccess={handleCompanyCreated}
      />

      <AddWalletModal
        open={phase === "wallet"}
        onClose={() => {
          // If user closes the wallet modal but hasn't created one yet,
          // let them proceed to dashboard (they can add later)
          if (!hasWallet) {
            setPhase("done");
          }
        }}
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
