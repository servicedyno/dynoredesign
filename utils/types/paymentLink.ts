export interface PaymentLink {
  link_id: string;
  amount: number;
  currency: string;
  description: string;
  status: PaymentLinkStatus;
  clientName: string;
  expire: string;
  blockchainFees: string;
  acceptedCryptoCurrency: string[];
  payment_url: string;
  redirect_url: string;
  webhook_url: string;
  metadata: {
    order_id: string;
    customer_email: string;
  };
  created_at: string;
  paid_at: string;
  transaction: {
    transaction_id: string;
    crypto_currency: string;
    crypto_amount: number;
    confirmations: number;
    tx_hash: string;
  };
}

export interface PaymentLinksProps {
  setPageName?: (v: string) => void;
  setPageDescription?: (v: string) => void;
  setPageAction?: (v: React.ReactNode | null) => void;
}

export type PaymentLinkStatus = "active" | "expired" | "paid" | "pending";

export interface PaymentLinkData {
  id: string;
  description: string;
  usdValue: string;
  cryptoValue?: string;
  createdAt: string;
  expiresAt: string;
  status: PaymentLinkStatus;
  timesUsed: number;
}

export interface PaymentLinksTableProps {
  paymentLinks: PaymentLinkData[];
  rowsPerPage?: number;
}

export interface PaymentLinkSuccessModalProps {
  open: boolean;
  onClose: () => void;
  paymentLink: string;
  paymentSettings: {
    value: string;
    cryptoValue: string;
    expire: string;
    description: string;
    blockchainFees: string;
    linkId: string;
  };
  onCopyLink: () => void;
}

export interface PaymentDetailRowProps {
  icon: string;
  alt: string;
  label: string;
  value: React.ReactNode;
  iconStyle?: React.CSSProperties;
  alignTop?: boolean;
}
