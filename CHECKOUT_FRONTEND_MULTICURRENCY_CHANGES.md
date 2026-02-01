# DynoPay Checkout Frontend - Multi-Currency UI/UX Changes

**Repository:** https://github.com/Moxxcompany/DynocheckoutDarkMode  
**Date:** 2026-02-01  
**Status:** Analysis Complete

---

## Executive Summary

The checkout frontend currently supports only **3 fiat currencies** (USD, EUR, NGN) and **NO USDC icon**. To support the backend's 38+ currencies, the following changes are required across **6 files**.

---

## Current State

### Existing Flag Icons (`/assets/Icons/flag/`)
| Icon | Status |
|------|--------|
| USD.png | ✅ Exists |
| EUR.png | ✅ Exists |
| NGN.png | ✅ Exists |

### Existing Crypto Icons (`/assets/Icons/coins/`)
| Icon | Status |
|------|--------|
| BTC.tsx | ✅ Exists |
| ETH.tsx | ✅ Exists |
| BNB.tsx | ✅ Exists |
| USDT.tsx | ✅ Exists |
| LTC.png | ✅ Exists |
| DOGE.png | ✅ Exists |
| TRX.png | ✅ Exists |
| BCH.png | ✅ Exists |
| **USDC** | ❌ **MISSING** |

---

## Required Changes

### 1. Add Flag Icons (35 new icons needed)

**File Location:** `/assets/Icons/flag/`

#### International (8 new)
| Currency | Filename | Country Flag |
|----------|----------|--------------|
| GBP | GBP.png | 🇬🇧 United Kingdom |
| AUD | AUD.png | 🇦🇺 Australia |
| CAD | CAD.png | 🇨🇦 Canada |
| CHF | CHF.png | 🇨🇭 Switzerland |
| CNY | CNY.png | 🇨🇳 China |
| JPY | JPY.png | 🇯🇵 Japan |
| HKD | HKD.png | 🇭🇰 Hong Kong |
| NZD | NZD.png | 🇳🇿 New Zealand |
| SGD | SGD.png | 🇸🇬 Singapore |

#### Latin America (8 new)
| Currency | Filename | Country Flag |
|----------|----------|--------------|
| BRL | BRL.png | 🇧🇷 Brazil |
| ARS | ARS.png | 🇦🇷 Argentina |
| COP | COP.png | 🇨🇴 Colombia |
| CLP | CLP.png | 🇨🇱 Chile |
| PEN | PEN.png | 🇵🇪 Peru |
| MXN | MXN.png | 🇲🇽 Mexico |
| VES | VES.png | 🇻🇪 Venezuela |
| UYU | UYU.png | 🇺🇾 Uruguay |

#### Africa (15 new)
| Currency | Filename | Country/Region Flag |
|----------|----------|---------------------|
| ZAR | ZAR.png | 🇿🇦 South Africa |
| KES | KES.png | 🇰🇪 Kenya |
| GHS | GHS.png | 🇬🇭 Ghana |
| TZS | TZS.png | 🇹🇿 Tanzania |
| XAF | XAF.png | 🇨🇲 Central Africa (use Cameroon) |
| XOF | XOF.png | 🇸🇳 West Africa (use Senegal) |
| EGP | EGP.png | 🇪🇬 Egypt |
| MAD | MAD.png | 🇲🇦 Morocco |
| UGX | UGX.png | 🇺🇬 Uganda |
| RWF | RWF.png | 🇷🇼 Rwanda |
| ETB | ETB.png | 🇪🇹 Ethiopia |
| ZMW | ZMW.png | 🇿🇲 Zambia |
| BWP | BWP.png | 🇧🇼 Botswana |
| MUR | MUR.png | 🇲🇺 Mauritius |
| AOA | AOA.png | 🇦🇴 Angola |
| MZN | MZN.png | 🇲🇿 Mozambique |
| CDF | CDF.png | 🇨🇩 DR Congo |

---

### 2. Add USDC Icon

**File Location:** `/assets/Icons/coins/USDC.tsx`

```tsx
// Create new file: /assets/Icons/coins/USDC.tsx
import React from 'react';

const USDCIcon = ({ size = 24 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="16" cy="16" r="16" fill="#2775CA"/>
    <path d="M20.5 18.5C20.5 16.5 19 15.5 16 15C13.5 14.5 13 14 13 13C13 12 14 11.5 15.5 11.5C17 11.5 17.5 12 18 13L20 12C19.5 10.5 18 9.5 16.5 9.5V8H15V9.5C13 10 11.5 11.5 11.5 13.5C11.5 15.5 13 16.5 16 17C18 17.5 19 18 19 19C19 20 18 20.5 16.5 20.5C15 20.5 14 20 13.5 18.5L11.5 19.5C12 21 13.5 22 15 22.5V24H16.5V22.5C19 22 20.5 20.5 20.5 18.5Z" fill="white"/>
  </svg>
);

export default USDCIcon;
```

---

### 3. Update Currency Options Array

**File:** `/pages/pay/index.tsx`

#### Current Code (lines 49-103):
```tsx
import USDIcon from '../../assets/Icons/flag/USD.png'
import EURIcon from '../../assets/Icons/flag/EUR.png'
import NGNIcon from '../../assets/Icons/flag/NGN.png'

export const currencyOptions = [
  { code: 'USD', labelKey: 'currency.USD', icon: <Image src={USDIcon} ... />, currency: 'USD' },
  { code: 'EUR', labelKey: 'currency.EUR', icon: <Image src={EURIcon} ... />, currency: 'EUR' },
  { code: 'NGN', labelKey: 'currency.NGN', icon: <Image src={NGNIcon} ... />, currency: 'NGN' }
]
```

#### Updated Code:
```tsx
// Add imports for all new flag icons
import USDIcon from '../../assets/Icons/flag/USD.png'
import EURIcon from '../../assets/Icons/flag/EUR.png'
import GBPIcon from '../../assets/Icons/flag/GBP.png'
import AUDIcon from '../../assets/Icons/flag/AUD.png'
import CADIcon from '../../assets/Icons/flag/CAD.png'
import CHFIcon from '../../assets/Icons/flag/CHF.png'
import CNYIcon from '../../assets/Icons/flag/CNY.png'
import JPYIcon from '../../assets/Icons/flag/JPY.png'
import HKDIcon from '../../assets/Icons/flag/HKD.png'
import NZDIcon from '../../assets/Icons/flag/NZD.png'
import SGDIcon from '../../assets/Icons/flag/SGD.png'
// Latin America
import BRLIcon from '../../assets/Icons/flag/BRL.png'
import ARSIcon from '../../assets/Icons/flag/ARS.png'
import COPIcon from '../../assets/Icons/flag/COP.png'
import CLPIcon from '../../assets/Icons/flag/CLP.png'
import PENIcon from '../../assets/Icons/flag/PEN.png'
import MXNIcon from '../../assets/Icons/flag/MXN.png'
import VESIcon from '../../assets/Icons/flag/VES.png'
import UYUIcon from '../../assets/Icons/flag/UYU.png'
// Africa
import NGNIcon from '../../assets/Icons/flag/NGN.png'
import ZARIcon from '../../assets/Icons/flag/ZAR.png'
import KESIcon from '../../assets/Icons/flag/KES.png'
import GHSIcon from '../../assets/Icons/flag/GHS.png'
import TZSIcon from '../../assets/Icons/flag/TZS.png'
import XAFIcon from '../../assets/Icons/flag/XAF.png'
import XOFIcon from '../../assets/Icons/flag/XOF.png'
import EGPIcon from '../../assets/Icons/flag/EGP.png'
import MADIcon from '../../assets/Icons/flag/MAD.png'
import UGXIcon from '../../assets/Icons/flag/UGX.png'
import RWFIcon from '../../assets/Icons/flag/RWF.png'
import ETBIcon from '../../assets/Icons/flag/ETB.png'
import ZMWIcon from '../../assets/Icons/flag/ZMW.png'
import BWPIcon from '../../assets/Icons/flag/BWP.png'
import MURIcon from '../../assets/Icons/flag/MUR.png'
import AOAIcon from '../../assets/Icons/flag/AOA.png'
import MZNIcon from '../../assets/Icons/flag/MZN.png'
import CDFIcon from '../../assets/Icons/flag/CDF.png'

export const currencyOptions = [
  // International
  { code: 'USD', labelKey: 'currency.USD', icon: <Image src={USDIcon} alt='USD' width={20} height={20} />, currency: 'USD', symbol: '$', decimals: 2 },
  { code: 'EUR', labelKey: 'currency.EUR', icon: <Image src={EURIcon} alt='EUR' width={20} height={20} />, currency: 'EUR', symbol: '€', decimals: 2 },
  { code: 'GBP', labelKey: 'currency.GBP', icon: <Image src={GBPIcon} alt='GBP' width={20} height={20} />, currency: 'GBP', symbol: '£', decimals: 2 },
  { code: 'AUD', labelKey: 'currency.AUD', icon: <Image src={AUDIcon} alt='AUD' width={20} height={20} />, currency: 'AUD', symbol: 'A$', decimals: 2 },
  { code: 'CAD', labelKey: 'currency.CAD', icon: <Image src={CADIcon} alt='CAD' width={20} height={20} />, currency: 'CAD', symbol: 'C$', decimals: 2 },
  { code: 'CHF', labelKey: 'currency.CHF', icon: <Image src={CHFIcon} alt='CHF' width={20} height={20} />, currency: 'CHF', symbol: 'Fr', decimals: 2 },
  { code: 'CNY', labelKey: 'currency.CNY', icon: <Image src={CNYIcon} alt='CNY' width={20} height={20} />, currency: 'CNY', symbol: '¥', decimals: 2 },
  { code: 'JPY', labelKey: 'currency.JPY', icon: <Image src={JPYIcon} alt='JPY' width={20} height={20} />, currency: 'JPY', symbol: '¥', decimals: 0 },
  { code: 'HKD', labelKey: 'currency.HKD', icon: <Image src={HKDIcon} alt='HKD' width={20} height={20} />, currency: 'HKD', symbol: 'HK$', decimals: 2 },
  { code: 'NZD', labelKey: 'currency.NZD', icon: <Image src={NZDIcon} alt='NZD' width={20} height={20} />, currency: 'NZD', symbol: 'NZ$', decimals: 2 },
  { code: 'SGD', labelKey: 'currency.SGD', icon: <Image src={SGDIcon} alt='SGD' width={20} height={20} />, currency: 'SGD', symbol: 'S$', decimals: 2 },
  // Latin America
  { code: 'BRL', labelKey: 'currency.BRL', icon: <Image src={BRLIcon} alt='BRL' width={20} height={20} />, currency: 'BRL', symbol: 'R$', decimals: 2 },
  { code: 'ARS', labelKey: 'currency.ARS', icon: <Image src={ARSIcon} alt='ARS' width={20} height={20} />, currency: 'ARS', symbol: '$', decimals: 2 },
  { code: 'COP', labelKey: 'currency.COP', icon: <Image src={COPIcon} alt='COP' width={20} height={20} />, currency: 'COP', symbol: '$', decimals: 0 },
  { code: 'CLP', labelKey: 'currency.CLP', icon: <Image src={CLPIcon} alt='CLP' width={20} height={20} />, currency: 'CLP', symbol: '$', decimals: 0 },
  { code: 'PEN', labelKey: 'currency.PEN', icon: <Image src={PENIcon} alt='PEN' width={20} height={20} />, currency: 'PEN', symbol: 'S/', decimals: 2 },
  { code: 'MXN', labelKey: 'currency.MXN', icon: <Image src={MXNIcon} alt='MXN' width={20} height={20} />, currency: 'MXN', symbol: '$', decimals: 2 },
  { code: 'VES', labelKey: 'currency.VES', icon: <Image src={VESIcon} alt='VES' width={20} height={20} />, currency: 'VES', symbol: 'Bs', decimals: 2 },
  { code: 'UYU', labelKey: 'currency.UYU', icon: <Image src={UYUIcon} alt='UYU' width={20} height={20} />, currency: 'UYU', symbol: '$U', decimals: 2 },
  // Africa
  { code: 'NGN', labelKey: 'currency.NGN', icon: <Image src={NGNIcon} alt='NGN' width={20} height={20} />, currency: 'NGN', symbol: '₦', decimals: 2 },
  { code: 'ZAR', labelKey: 'currency.ZAR', icon: <Image src={ZARIcon} alt='ZAR' width={20} height={20} />, currency: 'ZAR', symbol: 'R', decimals: 2 },
  { code: 'KES', labelKey: 'currency.KES', icon: <Image src={KESIcon} alt='KES' width={20} height={20} />, currency: 'KES', symbol: 'KSh', decimals: 2 },
  { code: 'GHS', labelKey: 'currency.GHS', icon: <Image src={GHSIcon} alt='GHS' width={20} height={20} />, currency: 'GHS', symbol: '₵', decimals: 2 },
  { code: 'TZS', labelKey: 'currency.TZS', icon: <Image src={TZSIcon} alt='TZS' width={20} height={20} />, currency: 'TZS', symbol: 'TSh', decimals: 0 },
  { code: 'XAF', labelKey: 'currency.XAF', icon: <Image src={XAFIcon} alt='XAF' width={20} height={20} />, currency: 'XAF', symbol: 'FCFA', decimals: 0 },
  { code: 'XOF', labelKey: 'currency.XOF', icon: <Image src={XOF} alt='XOF' width={20} height={20} />, currency: 'XOF', symbol: 'CFA', decimals: 0 },
  { code: 'EGP', labelKey: 'currency.EGP', icon: <Image src={EGPIcon} alt='EGP' width={20} height={20} />, currency: 'EGP', symbol: 'E£', decimals: 2 },
  { code: 'MAD', labelKey: 'currency.MAD', icon: <Image src={MADIcon} alt='MAD' width={20} height={20} />, currency: 'MAD', symbol: 'DH', decimals: 2 },
  { code: 'UGX', labelKey: 'currency.UGX', icon: <Image src={UGXIcon} alt='UGX' width={20} height={20} />, currency: 'UGX', symbol: 'USh', decimals: 0 },
  { code: 'RWF', labelKey: 'currency.RWF', icon: <Image src={RWFIcon} alt='RWF' width={20} height={20} />, currency: 'RWF', symbol: 'FRw', decimals: 0 },
  { code: 'ETB', labelKey: 'currency.ETB', icon: <Image src={ETBIcon} alt='ETB' width={20} height={20} />, currency: 'ETB', symbol: 'Br', decimals: 2 },
  { code: 'ZMW', labelKey: 'currency.ZMW', icon: <Image src={ZMWIcon} alt='ZMW' width={20} height={20} />, currency: 'ZMW', symbol: 'ZK', decimals: 2 },
  { code: 'BWP', labelKey: 'currency.BWP', icon: <Image src={BWPIcon} alt='BWP' width={20} height={20} />, currency: 'BWP', symbol: 'P', decimals: 2 },
  { code: 'MUR', labelKey: 'currency.MUR', icon: <Image src={MURIcon} alt='MUR' width={20} height={20} />, currency: 'MUR', symbol: '₨', decimals: 2 },
  { code: 'AOA', labelKey: 'currency.AOA', icon: <Image src={AOAIcon} alt='AOA' width={20} height={20} />, currency: 'AOA', symbol: 'Kz', decimals: 2 },
  { code: 'MZN', labelKey: 'currency.MZN', icon: <Image src={MZNIcon} alt='MZN' width={20} height={20} />, currency: 'MZN', symbol: 'MT', decimals: 2 },
  { code: 'CDF', labelKey: 'currency.CDF', icon: <Image src={CDFIcon} alt='CDF' width={20} height={20} />, currency: 'CDF', symbol: 'FC', decimals: 2 },
]
```

---

### 4. Update Translations

**File:** `/public/locales/en/common.json`

Add to the `currency` object:
```json
{
  "currency": {
    "USD": "United States Dollar (USD)",
    "EUR": "Euro (EUR)",
    "GBP": "British Pound (GBP)",
    "AUD": "Australian Dollar (AUD)",
    "CAD": "Canadian Dollar (CAD)",
    "CHF": "Swiss Franc (CHF)",
    "CNY": "Chinese Yuan (CNY)",
    "JPY": "Japanese Yen (JPY)",
    "HKD": "Hong Kong Dollar (HKD)",
    "NZD": "New Zealand Dollar (NZD)",
    "SGD": "Singapore Dollar (SGD)",
    "BRL": "Brazilian Real (BRL)",
    "ARS": "Argentine Peso (ARS)",
    "COP": "Colombian Peso (COP)",
    "CLP": "Chilean Peso (CLP)",
    "PEN": "Peruvian Sol (PEN)",
    "MXN": "Mexican Peso (MXN)",
    "VES": "Venezuelan Bolívar (VES)",
    "UYU": "Uruguayan Peso (UYU)",
    "NGN": "Nigerian Naira (NGN)",
    "ZAR": "South African Rand (ZAR)",
    "KES": "Kenyan Shilling (KES)",
    "GHS": "Ghanaian Cedi (GHS)",
    "TZS": "Tanzanian Shilling (TZS)",
    "XAF": "CFA Franc - Central Africa (XAF)",
    "XOF": "CFA Franc - West Africa (XOF)",
    "EGP": "Egyptian Pound (EGP)",
    "MAD": "Moroccan Dirham (MAD)",
    "UGX": "Ugandan Shilling (UGX)",
    "RWF": "Rwandan Franc (RWF)",
    "ETB": "Ethiopian Birr (ETB)",
    "ZMW": "Zambian Kwacha (ZMW)",
    "BWP": "Botswanan Pula (BWP)",
    "MUR": "Mauritian Rupee (MUR)",
    "AOA": "Angolan Kwanza (AOA)",
    "MZN": "Mozambican Metical (MZN)",
    "CDF": "Congolese Franc (CDF)"
  }
}
```

**Also update other locale files:**
- `/public/locales/pt/common.json` (Portuguese)
- `/public/locales/es/common.json` (Spanish - if exists)
- `/public/locales/fr/common.json` (French - if exists)

---

### 5. Update Currency Symbol Helper

**File:** `/helpers/index.ts`

Update the `getCurrencySymbol` function:

```typescript
const getCurrencySymbol = (currency: string, amount: number | string): string => {
  const symbols: Record<string, string> = {
    // International
    USD: '$',
    EUR: '€',
    GBP: '£',
    AUD: 'A$',
    CAD: 'C$',
    CHF: 'Fr',
    CNY: '¥',
    JPY: '¥',
    HKD: 'HK$',
    NZD: 'NZ$',
    SGD: 'S$',
    // Latin America
    BRL: 'R$',
    ARS: '$',
    COP: '$',
    CLP: '$',
    PEN: 'S/',
    MXN: '$',
    VES: 'Bs',
    UYU: '$U',
    // Africa
    NGN: '₦',
    ZAR: 'R',
    KES: 'KSh',
    GHS: '₵',
    TZS: 'TSh',
    XAF: 'FCFA',
    XOF: 'CFA',
    EGP: 'E£',
    MAD: 'DH',
    UGX: 'USh',
    RWF: 'FRw',
    ETB: 'Br',
    ZMW: 'ZK',
    BWP: 'P',
    MUR: '₨',
    AOA: 'Kz',
    MZN: 'MT',
    CDF: 'FC',
  };

  const symbol = symbols[currency?.toUpperCase()] || '';
  return symbol ? `${symbol} ${amount}` : String(amount);
};
```

---

### 6. Add Currency Formatting Utility (New File)

**File:** `/utils/currencyFormat.ts` (NEW)

```typescript
interface CurrencyFormat {
  symbol: string;
  decimals: number;
  locale: string;
}

const currencyFormats: Record<string, CurrencyFormat> = {
  // International
  USD: { symbol: '$', decimals: 2, locale: 'en-US' },
  EUR: { symbol: '€', decimals: 2, locale: 'de-DE' },
  GBP: { symbol: '£', decimals: 2, locale: 'en-GB' },
  AUD: { symbol: 'A$', decimals: 2, locale: 'en-AU' },
  CAD: { symbol: 'C$', decimals: 2, locale: 'en-CA' },
  CHF: { symbol: 'Fr', decimals: 2, locale: 'de-CH' },
  CNY: { symbol: '¥', decimals: 2, locale: 'zh-CN' },
  JPY: { symbol: '¥', decimals: 0, locale: 'ja-JP' },  // NO decimals
  HKD: { symbol: 'HK$', decimals: 2, locale: 'zh-HK' },
  NZD: { symbol: 'NZ$', decimals: 2, locale: 'en-NZ' },
  SGD: { symbol: 'S$', decimals: 2, locale: 'en-SG' },
  // Latin America
  BRL: { symbol: 'R$', decimals: 2, locale: 'pt-BR' },
  ARS: { symbol: '$', decimals: 2, locale: 'es-AR' },
  COP: { symbol: '$', decimals: 0, locale: 'es-CO' },  // NO decimals
  CLP: { symbol: '$', decimals: 0, locale: 'es-CL' },  // NO decimals
  PEN: { symbol: 'S/', decimals: 2, locale: 'es-PE' },
  MXN: { symbol: '$', decimals: 2, locale: 'es-MX' },
  VES: { symbol: 'Bs', decimals: 2, locale: 'es-VE' },
  UYU: { symbol: '$U', decimals: 2, locale: 'es-UY' },
  // Africa
  NGN: { symbol: '₦', decimals: 2, locale: 'en-NG' },
  ZAR: { symbol: 'R', decimals: 2, locale: 'en-ZA' },
  KES: { symbol: 'KSh', decimals: 2, locale: 'en-KE' },
  GHS: { symbol: '₵', decimals: 2, locale: 'en-GH' },
  TZS: { symbol: 'TSh', decimals: 0, locale: 'sw-TZ' },  // NO decimals
  XAF: { symbol: 'FCFA', decimals: 0, locale: 'fr-CM' }, // NO decimals
  XOF: { symbol: 'CFA', decimals: 0, locale: 'fr-SN' },  // NO decimals
  EGP: { symbol: 'E£', decimals: 2, locale: 'ar-EG' },
  MAD: { symbol: 'DH', decimals: 2, locale: 'ar-MA' },
  UGX: { symbol: 'USh', decimals: 0, locale: 'en-UG' },  // NO decimals
  RWF: { symbol: 'FRw', decimals: 0, locale: 'rw-RW' },  // NO decimals
  ETB: { symbol: 'Br', decimals: 2, locale: 'am-ET' },
  ZMW: { symbol: 'ZK', decimals: 2, locale: 'en-ZM' },
  BWP: { symbol: 'P', decimals: 2, locale: 'en-BW' },
  MUR: { symbol: '₨', decimals: 2, locale: 'en-MU' },
  AOA: { symbol: 'Kz', decimals: 2, locale: 'pt-AO' },
  MZN: { symbol: 'MT', decimals: 2, locale: 'pt-MZ' },
  CDF: { symbol: 'FC', decimals: 2, locale: 'fr-CD' },
};

export const formatCurrency = (amount: number, currency: string): string => {
  const format = currencyFormats[currency?.toUpperCase()] || { symbol: '', decimals: 2, locale: 'en-US' };
  
  try {
    return new Intl.NumberFormat(format.locale, {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: format.decimals,
      maximumFractionDigits: format.decimals
    }).format(amount);
  } catch {
    // Fallback for unsupported currencies
    return `${format.symbol} ${amount.toFixed(format.decimals)}`;
  }
};

export const getCurrencyDecimals = (currency: string): number => {
  return currencyFormats[currency?.toUpperCase()]?.decimals ?? 2;
};

export const getCurrencySymbol = (currency: string): string => {
  return currencyFormats[currency?.toUpperCase()]?.symbol ?? '';
};

export default currencyFormats;
```

---

## Summary of Changes

| File | Change Type | Description |
|------|-------------|-------------|
| `/assets/Icons/flag/*.png` | ADD | 35 new country flag icons |
| `/assets/Icons/coins/USDC.tsx` | ADD | **USDC stablecoin icon (MISSING)** |
| `/pages/pay/index.tsx` | MODIFY | Add imports & expand currencyOptions array |
| `/public/locales/en/common.json` | MODIFY | Add 35 new currency translations |
| `/public/locales/pt/common.json` | MODIFY | Add Portuguese translations |
| `/helpers/index.ts` | MODIFY | Update getCurrencySymbol function |
| `/utils/currencyFormat.ts` | ADD | New currency formatting utility |

---

## Icon Sources

Recommended sources for flag icons (20x20 or 24x24 PNG):
1. **FlagCDN:** https://flagcdn.com/
2. **Country Flags API:** https://countryflagsapi.com/
3. **Flagpedia:** https://flagpedia.net/

For USDC icon:
- Official USDC brand assets: https://www.circle.com/en/usdc/brand

---

## Testing Checklist

After implementing changes:

- [ ] All 38 currencies display correct flag icons
- [ ] Currency selector dropdown shows all currencies
- [ ] JPY, COP, CLP, XAF, XOF show no decimal places
- [ ] Currency symbols display correctly in payment summary
- [ ] USDC icon appears in crypto selection
- [ ] Translations work for all locales
- [ ] Mobile responsiveness of currency selector

---

*Analysis prepared for DynoPay Checkout Frontend Multi-Currency Support*
