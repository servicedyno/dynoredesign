import { WalletAction } from "@/Redux/Actions";
import { WALLET_FETCH } from "@/Redux/Actions/WalletAction";
import { rootReducer } from "@/utils/types";
import { useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";

import BitcoinIcon from "@/assets/cryptocurrency/Bitcoin-icon.svg";
import BitcoinCashIcon from "@/assets/cryptocurrency/BitcoinCash-icon.svg";
import BNBIcon from "@/assets/cryptocurrency/BNB-icon.svg";
import DogecoinIcon from "@/assets/cryptocurrency/Dogecoin-icon.svg";
import EthereumIcon from "@/assets/cryptocurrency/Ethereum-icon.svg";
import LitecoinIcon from "@/assets/cryptocurrency/Litecoin-icon.svg";
import PolygonIcon from "@/assets/cryptocurrency/Polygon-icon.svg";
import RLUSDIcon from "@/assets/cryptocurrency/RLUSD-icon.svg";
import SolanaIcon from "@/assets/cryptocurrency/Solana-icon.svg";
import TronIcon from "@/assets/cryptocurrency/Tron-icon.svg";
import USDTIcon from "@/assets/cryptocurrency/USDT-icon.svg";
import XRPIcon from "@/assets/cryptocurrency/XRP-icon.svg";
import {
  Cryptocurrency,
  WalletDataType,
  WalletType,
} from "@/utils/types/wallet";

/* ------------------------------- Static Maps ------------------------------- */

const WALLET_ORDER: readonly WalletType[] = [
  "BTC",
  "ETH",
  "LTC",
  "DOGE",
  "BCH",
  "TRX",
  "SOL",
  "XRP",
  "BNB",
  "POLYGON",
  "USDT-ERC20",
  "USDT-TRC20",
  "USDT-POLYGON",
  "USDC-ERC20",
  "RLUSD",
  "RLUSD-ERC20",
];

const WALLET_ICONS: Record<WalletType, any> = {
  BTC: BitcoinIcon,
  ETH: EthereumIcon,
  LTC: LitecoinIcon,
  DOGE: DogecoinIcon,
  BCH: BitcoinCashIcon,
  TRX: TronIcon,
  SOL: SolanaIcon,
  XRP: XRPIcon,
  BNB: BNBIcon,
  POLYGON: PolygonIcon,
  "USDT-ERC20": USDTIcon,
  "USDT-TRC20": USDTIcon,
  "USDT-POLYGON": USDTIcon,
  "USDC-ERC20": USDTIcon,
  RLUSD: RLUSDIcon,
  "RLUSD-ERC20": RLUSDIcon,
};

const WALLET_NAMES: Record<WalletType, string> = {
  BTC: "Bitcoin",
  ETH: "Ethereum",
  LTC: "Litecoin",
  DOGE: "Dogecoin",
  BCH: "Bitcoin Cash",
  TRX: "Tron",
  SOL: "Solana",
  XRP: "Ripple",
  BNB: "BNB",
  POLYGON: "Polygon (POL)",
  "USDT-ERC20": "USDT-ERC20",
  "USDT-TRC20": "USDT-TRC20",
  "USDT-POLYGON": "USDT-Polygon",
  "USDC-ERC20": "USDC-ERC20",
  RLUSD: "RLUSD",
  "RLUSD-ERC20": "RLUSD-ERC20",
};

export const ALLCRYPTOCURRENCIES: readonly Cryptocurrency[] = [
  { code: "BTC", name: "Bitcoin", icon: BitcoinIcon },
  { code: "ETH", name: "Ethereum", icon: EthereumIcon },
  { code: "LTC", name: "Litecoin", icon: LitecoinIcon },
  { code: "DOGE", name: "Dogecoin", icon: DogecoinIcon },
  { code: "BCH", name: "Bitcoin Cash", icon: BitcoinCashIcon },
  { code: "TRX", name: "Tron", icon: TronIcon },
  { code: "SOL", name: "Solana", icon: SolanaIcon },
  { code: "XRP", name: "Ripple", icon: XRPIcon },
  { code: "BNB", name: "BNB", icon: BNBIcon },
  { code: "POLYGON", name: "Polygon (POL)", icon: PolygonIcon },
  { code: "USDT-ERC20", name: "USDT-ERC20", icon: USDTIcon },
  { code: "USDT-TRC20", name: "USDT-TRC20", icon: USDTIcon },
  { code: "USDT-POLYGON", name: "USDT-Polygon", icon: USDTIcon },
  { code: "USDC-ERC20", name: "USDC-ERC20", icon: USDTIcon },
  { code: "RLUSD", name: "RLUSD", icon: RLUSDIcon },
  { code: "RLUSD-ERC20", name: "RLUSD-ERC20", icon: RLUSDIcon },
];

const requestedWalletFetchByToken = new Set<string>();

/* ------------------------------- Main Hook -------------------------------- */

export const useWalletData = () => {
  const dispatch = useDispatch();
  const walletState = useSelector((state: rootReducer) => state.walletReducer);
  const walletLoading = Boolean(walletState?.loading);
  const walletListLength = Array.isArray(walletState?.walletList)
    ? walletState.walletList.length
    : 0;
  const [walletWarning, setWalletWarning] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const token = window.localStorage.getItem("token");
    if (!token) return;
    if (walletListLength > 0) {
      requestedWalletFetchByToken.add(token);
      return;
    }
    if (walletLoading) return;
    if (requestedWalletFetchByToken.has(token)) return;

    requestedWalletFetchByToken.add(token);
    dispatch(WalletAction(WALLET_FETCH));
  }, [dispatch, walletLoading, walletListLength]);

  /* ---------------------------- Wallet Data ---------------------------- */

  const walletData = useMemo<WalletDataType[]>(() => {
    const list = Array.isArray(walletState?.walletList)
      ? walletState.walletList
      : [];
    if (!list.length) return [];

    return list
      .filter(
        (wallet) =>
          WALLET_ORDER.includes(wallet.wallet_type as WalletType) &&
          Boolean(wallet.wallet_address),
      )
      .sort(
        (a, b) =>
          WALLET_ORDER.indexOf(a.wallet_type as WalletType) -
          WALLET_ORDER.indexOf(b.wallet_type as WalletType),
      )
      .map((wallet) => {
        const type = wallet.wallet_type as WalletType;

        return {
          icon: WALLET_ICONS[type],
          walletTitle: type,
          walletAddress: wallet.wallet_address,
          name: WALLET_NAMES[type],
          totalProcessed: Number(wallet.amount_in_usd) || 0,
        };
      });
  }, [walletState?.walletList]);

  /* ------------------ Cryptocurrencies NOT in Wallet ------------------ */

  const cryptocurrencies = useMemo<Cryptocurrency[]>(() => {
    if (!walletData.length) return [...ALLCRYPTOCURRENCIES];

    return ALLCRYPTOCURRENCIES.filter(
      (crypto) =>
        !walletData.some((wallet) => wallet.walletTitle === crypto.code),
    );
  }, [walletData]);

  useEffect(() => {
    if (walletLoading) {
      setWalletWarning(false);
      return;
    }
    setWalletWarning(cryptocurrencies.length > 0);
  }, [walletLoading, cryptocurrencies]);

  const activeWalletsData = useMemo(() => {
    return ALLCRYPTOCURRENCIES.filter((crypto) => {
      return !cryptocurrencies.some((c) => c.code === crypto.code);
    });
  }, [cryptocurrencies]);

  return {
    walletLoading,
    walletData,
    cryptocurrencies,
    walletWarning,
    activeWalletsData,
  };
};
