import { CompanyAction, WalletAction, PaymentLinkAction } from "@/Redux/Actions";
import { COMPANY_FETCH } from "@/Redux/Actions/CompanyAction";
import { WALLET_FETCH } from "@/Redux/Actions/WalletAction";
import { PAYLINK_FETCH } from "@/Redux/Actions/PaymentLinkAction";
import { rootReducer } from "@/utils/types";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useRouter } from "next/router";
import {
  BusinessRounded,
  AccountBalanceWalletRounded,
  LinkRounded,
} from "@mui/icons-material";
import CreateCompanyModal from "./CreateCompanyModal";
import AddWalletModal from "@/Components/UI/AddWalletModal";
import CelebrationOverlay from "./CelebrationOverlay";
import StepIndicator from "./StepIndicator";
import OnboardingChecklist, { ChecklistStep } from "./OnboardingChecklist";

type ActiveModal = "company" | "wallet" | null;

/**
 * Onboarding orchestrator (non-blocking + resumable).
 *
 * - Renders a persistent checklist card (derived from real account data).
 * - Launches the company / wallet wizard modals from the checklist.
 * - Auto-opens the company step ONCE for brand-new users (closable).
 * - Surfaces "Create your first payment link" as the activation step.
 */
const OnboardingFlow: React.FC = () => {
  const dispatch = useDispatch();
  const router = useRouter();

  const [activeModal, setActiveModal] = useState<ActiveModal>(null);
  const [celebrate, setCelebrate] = useState(false);
  const [payLinkSettled, setPayLinkSettled] = useState(false);

  const loadingSeenTrue = useRef(false);
  const autoOpened = useRef(false);
  const dismissed = useRef(false);
  const payLinkRequested = useRef(false);
  const payLinkLoadingSeen = useRef(false);

  const companyState = useSelector((state: rootReducer) => state.companyReducer);
  const walletState = useSelector((state: rootReducer) => state.walletReducer);
  const payLinkState = useSelector(
    (state: rootReducer) => state.paymentLinkReducer,
  );

  const companyList = companyState.companyList ?? [];
  const walletList = walletState.walletList ?? [];
  const hasCompany = companyList.length > 0;
  const hasWallet = walletList.length > 0;
  const hasLink = (payLinkState.paymentLinks?.length ?? 0) > 0;

  const companyId =
    companyState.selectedCompanyId || companyList?.[0]?.company_id;

  const isCoreLoading = companyState.loading || walletState.loading;

  // Initial fetch of company + wallet
  useEffect(() => {
    dispatch(CompanyAction(COMPANY_FETCH));
    dispatch(WalletAction(WALLET_FETCH));
  }, [dispatch]);

  // Track that core fetches have actually run (true -> false)
  useEffect(() => {
    if (isCoreLoading) loadingSeenTrue.current = true;
  }, [isCoreLoading]);

  const coreReady = loadingSeenTrue.current && !isCoreLoading;

  // Once a company exists, fetch payment links once to know if step 3 is done
  useEffect(() => {
    if (hasCompany && companyId && !payLinkRequested.current) {
      payLinkRequested.current = true;
      dispatch(PaymentLinkAction(PAYLINK_FETCH, { company_id: companyId }));
    }
  }, [hasCompany, companyId, dispatch]);

  // Detect payment-link fetch settling (loading true -> false)
  useEffect(() => {
    if (!payLinkRequested.current) return;
    if (payLinkState.loading) {
      payLinkLoadingSeen.current = true;
    } else if (payLinkLoadingSeen.current) {
      setPayLinkSettled(true);
    }
  }, [payLinkState.loading]);

  // Auto-open the company step ONCE for brand-new users (closable, non-blocking)
  useEffect(() => {
    if (autoOpened.current || dismissed.current) return;
    if (!coreReady) return;
    if (!hasCompany && !hasWallet && !activeModal && !celebrate) {
      autoOpened.current = true;
      setActiveModal("company");
    }
  }, [coreReady, hasCompany, hasWallet, activeModal, celebrate]);

  // Company created -> refresh wallets and guide to wallet step
  const handleCompanyCreated = useCallback(() => {
    dispatch(WalletAction(WALLET_FETCH));
    setActiveModal("wallet");
  }, [dispatch]);

  // Wallet added -> refresh and celebrate
  const handleWalletAdded = useCallback(() => {
    dispatch(WalletAction(WALLET_FETCH));
    setActiveModal(null);
    setCelebrate(true);
  }, [dispatch]);

  const handleCelebrationDismiss = useCallback(() => {
    setCelebrate(false);
  }, []);

  // Closing a wizard modal should not re-trigger the auto-open this session
  const handleModalClose = useCallback(() => {
    dismissed.current = true;
    setActiveModal(null);
  }, []);

  const openCompany = useCallback(() => setActiveModal("company"), []);
  const openWallet = useCallback(() => {
    // wallet requires a company first
    if (!hasCompany) setActiveModal("company");
    else setActiveModal("wallet");
  }, [hasCompany]);
  const openFirstLink = useCallback(() => {
    if (!hasCompany) setActiveModal("company");
    else if (!hasWallet) setActiveModal("wallet");
    else router.push("/create-pay-link");
  }, [hasCompany, hasWallet, router]);

  const steps: ChecklistStep[] = useMemo(
    () => [
      {
        key: "company",
        label: "Create your company",
        description: "Add your business details",
        icon: BusinessRounded,
        done: hasCompany,
        onClick: openCompany,
      },
      {
        key: "wallet",
        label: "Add a payout wallet",
        description: "Required — funds are forwarded here",
        icon: AccountBalanceWalletRounded,
        done: hasWallet,
        onClick: openWallet,
      },
      {
        key: "link",
        label: "Create your first payment link",
        description: "Start getting paid in seconds",
        icon: LinkRounded,
        done: hasLink,
        onClick: openFirstLink,
      },
    ],
    [hasCompany, hasWallet, hasLink, openCompany, openWallet, openFirstLink],
  );

  // Decide whether to show the checklist card
  const allCoreDone = hasCompany && hasWallet;
  let showChecklist = false;
  if (coreReady) {
    if (!allCoreDone) {
      showChecklist = true;
    } else if (payLinkSettled && !hasLink) {
      // company + wallet done, but no payment link yet
      showChecklist = true;
    }
  }

  return (
    <>
      {showChecklist && <OnboardingChecklist steps={steps} />}

      <CreateCompanyModal
        open={activeModal === "company"}
        onSuccess={handleCompanyCreated}
        onClose={handleModalClose}
        closeLabel="I'll do this later"
      />

      <AddWalletModal
        open={activeModal === "wallet"}
        onClose={handleModalClose}
        onWalletAdded={handleWalletAdded}
        headerExtra={<StepIndicator currentStep={2} totalSteps={2} />}
      />

      <CelebrationOverlay
        open={celebrate}
        onDismiss={handleCelebrationDismiss}
      />
    </>
  );
};

export default OnboardingFlow;
