import { menuItem } from "../types";
import { DateRange } from "./dashboard";

export interface ExtendedTransaction {
  id: string;
  crypto: string;
  amount: string;
  usdValue: string;
  dateTime: string;
  status: "done" | "pending" | "failed";
  fees?: string;
  confirmations?: string;
  incomingTransactionId?: string;
  outgoingTransactionId?: string;
  callbackUrl?: string;
  webhookResponse?: {
    status: string;
    txid: string;
    amount: number;
    confirmations: number;
  };
}

export interface ICustomerTransactions {
  user_id: number;
  payment_mode: string;
  base_amount: number;
  base_currency: string;
  transaction_reference: string;
  transaction_type: string;
  status: string;
  customer_id: number;
  createdAt: string;
  updatedAt: string;
  transaction_details: string;
  id: string;
  customer_name: string;
  email: string;
  company_name: string;
  company_id: number;
}

export interface TransactionDetailsModalProps {
  open: boolean;
  onClose: () => void;
  transaction: ExtendedTransaction | null;
}

export interface TransactionsTableProps {
  transactions: ExtendedTransaction[];
  rowsPerPage?: number;
}
export interface TransactionsTopBarProps {
  onSearch?: (searchTerm: string) => void;
  onDateRangeChange?: (dateRange: DateRange) => void;
  onWalletChange?: (wallet: string) => void;
  onExport?: () => void;
}

export interface RowsPerPageSelectorProps {
  value: number;
  onChange: (value: number) => void;
  menuItems?: menuItem[];
}
