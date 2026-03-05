import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";

import { ICompany } from "@/utils/types";
import CompanySettingsDialog from "./index";

type CompanySettingsDialogContextValue = {
  openCompanySettings: (company: ICompany) => void;
  closeCompanySettings: () => void;
};

const CompanySettingsDialogContext =
  createContext<CompanySettingsDialogContextValue | null>(null);

export function useCompanySettingsDialog() {
  const ctx = useContext(CompanySettingsDialogContext);
  if (!ctx) {
    throw new Error(
      "useCompanySettingsDialog must be used within CompanySettingsDialogProvider",
    );
  }
  return ctx;
}

export function CompanySettingsDialogProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [company, setCompany] = useState<ICompany | null>(null);

  const closeCompanySettings = useCallback(() => {
    setOpen(false);
    setCompany(null);
  }, []);

  const openCompanySettings = useCallback((c: ICompany) => {
    setCompany(c);
    setOpen(true);
  }, []);

  const value = useMemo(
    () => ({ openCompanySettings, closeCompanySettings }),
    [openCompanySettings, closeCompanySettings],
  );

  return (
    <CompanySettingsDialogContext.Provider value={value}>
      {children}
      <CompanySettingsDialog
        open={open}
        company={company}
        onClose={closeCompanySettings}
      />
    </CompanySettingsDialogContext.Provider>
  );
}
