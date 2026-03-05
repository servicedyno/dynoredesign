import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useDispatch } from "react-redux";

import { CompanyAction } from "@/Redux/Actions";
import { COMPANY_FETCH } from "@/Redux/Actions/CompanyAction";
import { ICompany } from "@/utils/types";
import CompanyDialog, { CompanyDialogMode } from "./index";

type CompanyDialogContextValue = {
  openAddCompany: () => void;
  closeCompanyDialog: () => void;
};

const CompanyDialogContext = createContext<CompanyDialogContextValue | null>(
  null,
);

export function useCompanyDialog() {
  const ctx = useContext(CompanyDialogContext);
  if (!ctx) {
    throw new Error(
      "useCompanyDialog must be used within CompanyDialogProvider",
    );
  }
  return ctx;
}

export function CompanyDialogProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const dispatch = useDispatch();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<CompanyDialogMode>("add");
  const [company, setCompany] = useState<ICompany | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const token = window.localStorage.getItem("token");
    if (!token) return;
    dispatch(CompanyAction(COMPANY_FETCH));
  }, [dispatch]);

  const closeCompanyDialog = useCallback(() => {
    setOpen(false);
    setCompany(null);
    setMode("add");
  }, []);

  const openAddCompany = useCallback(() => {
    setMode("add");
    setCompany(null);
    setOpen(true);
  }, []);

  const value = useMemo(
    () => ({ openAddCompany, closeCompanyDialog }),
    [openAddCompany, closeCompanyDialog],
  );

  return (
    <CompanyDialogContext.Provider value={value}>
      {children}
      <CompanyDialog
        open={open}
        mode={mode}
        company={company}
        onClose={closeCompanyDialog}
      />
    </CompanyDialogContext.Provider>
  );
}
