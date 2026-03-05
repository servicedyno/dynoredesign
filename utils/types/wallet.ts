export interface WalletData {
  icon: any;
  walletTitle: string;
  walletAddress: string;
  name: string;
  totalProcessed: number;
}

export interface AddWalletModalProps {
  open: boolean;
  onClose: () => void;
  currentCryptocurrency?: string;
  fiatData?: any[];
  cryptoData?: any[];
  onWalletAdded?: () => void;
  headerExtra?: React.ReactNode;
}

export type Address = {
  wallet_address: string;
  currency: string;
};

export interface WalletError {
  walletName?: string;
  cryptocurrency?: string;
  walletAddress?: string;
}

export interface CryptocurrencySelectorProps {
  label?: string;
  value?: string;
  onChange?: (value: string) => void;
  error?: boolean;
  helperText?: string;
  fullWidth?: boolean;
  required?: boolean;
  name?: string;
  sx?: React.CSSProperties;
  sxIconChip?: React.CSSProperties;
  closeDropdownTrigger?: boolean;
}

export type WalletType =
  | "BTC"
  | "ETH"
  | "LTC"
  | "DOGE"
  | "BCH"
  | "TRX"
  | "SOL"
  | "XRP"
  | "BNB"
  | "POLYGON"
  | "USDT-ERC20"
  | "USDT-TRC20"
  | "USDT-POLYGON"
  | "USDC-ERC20"
  | "RLUSD"
  | "RLUSD-ERC20";

export type CryptoCode =
  | "BTC"
  | "ETH"
  | "LTC"
  | "DOGE"
  | "BCH"
  | "TRX"
  | "SOL"
  | "XRP"
  | "BNB"
  | "POLYGON"
  | "USDT-ERC20"
  | "USDT-TRC20"
  | "USDT-POLYGON"
  | "USDC-ERC20"
  | "RLUSD"
  | "RLUSD-ERC20";

export interface WalletDataType {
  icon: any;
  walletTitle: WalletType;
  walletAddress: string;
  name: string;
  totalProcessed: number;
}

export interface Cryptocurrency {
  code: CryptoCode;
  name: string;
  icon: any;
}
