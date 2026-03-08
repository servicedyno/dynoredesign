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
  const decisionMade = useRef(false);

  const companyState = useSelector(
    (state: rootReducer) => state.companyReducer,
  );
  const walletState = useSelector((state: rootReducer) => state.walletReducer);

  const companyList = companyState.companyList ?? [];
  const walletList = walletState.walletList ?? [];
  const hasCompany = companyList.length > 0;
  const hasWallet = walletList.length > 0;

  // Fetch data once on mount
  useEffect(() => {
    dispatch(CompanyAction(COMPANY_FETCH));
    dispatch(WalletAction(WALLET_FETCH));
  }, [dispatch]);

  // Simple decision: once we have data (lists populated), decide phase
  // This runs on every render until a decision is made
  useEffect(() => {
    if (decisionMade.current) return;

    // If either list has data, we can make a decision
    // (Don't wait for loading to finish — just check if data has arrived)
    if (hasCompany && hasWallet) {
      // User has both company and wallets — skip onboarding entirely
      decisionMade.current = true;
      setPhase("done");
      return;
    }

    // Only proceed to show modals if BOTH reducers are done loading
    // AND at least one fetch has returned (we check companyList explicitly)
    const bothDoneLoading = !companyState.loading && !walletState.loading;
    if (!bothDoneLoading) return;

    // At this point, loading is done. Check what's missing.
    // But only if at least one reducer has been populated
    // (initial state has loading=false AND empty lists, so we need a guard)
    const dataHasArrived = companyState.companyList !== undefined;
    if (!dataHasArrived) return;

    decisionMade.current = true;

    if (!hasCompany) {
      setPhase("company");
    } else if (!hasWallet) {
      setPhase("wallet");
    } else {
      setPhase("done");
    }
  }, [hasCompany, hasWallet, companyState.loading, walletState.loading, companyState.companyList]);

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

      {/* DIAGNOSTIC: Wallet modal disabled to trace source */}
      {phase === "wallet" && <div data-testid="onboarding-wallet-phase" style={{display:'none'}} />}

      <CelebrationOverlay
        open={phase === "celebration"}
        onDismiss={handleCelebrationDismiss}
      />
    </>
  );
};

export default OnboardingFlow;
