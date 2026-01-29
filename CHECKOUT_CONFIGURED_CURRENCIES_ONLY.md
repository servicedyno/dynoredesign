# DynoCheckoutFIX - Configured Currencies Implementation

## Overview

Update the checkout page to only show cryptocurrencies that the merchant has configured in their wallet.

---

## Backend API

**Endpoint:** `GET /api/pay/configured-currencies`

> **Note:** This endpoint requires customer authentication (the token received during checkout session initialization).

**Response:**
```json
{
  "message": "Configured currencies retrieved successfully",
  "data": {
    "configured_currencies": ["BTC", "ETH", "USDT-TRC20", "USDT-ERC20"],
    "wallet_count": 4,
    "wallets": [
      { "currency": "BTC", "label": "Bitcoin Wallet", "address_masked": "bc1q...xyz" },
      { "currency": "ETH", "label": "Ethereum Wallet", "address_masked": "0x12...89" }
    ],
    "skip_selection": false,
    "fee_payer": "customer",
    "fee_percent": 2.0,
    "fee_display": "2% fee applies"
  }
}
```

### Fee Information Fields:
| Field | Description |
|-------|-------------|
| `fee_payer` | Who pays the transaction fee: `"customer"` or `"company"` |
| `fee_percent` | Transaction fee percentage (e.g., `2.0` for 2%) |
| `fee_display` | Human-readable fee message for UI display |

---

## File: `Components/Page/Pay3Components/cryptoTransfer.tsx`

### Step 1: Add New State Variables

After the existing state declarations (around line 85), add:

```tsx
// Configured currencies from merchant
const [availableCryptos, setAvailableCryptos] = useState<string[]>([]);
const [availableUSDTNetworks, setAvailableUSDTNetworks] = useState<('TRC20' | 'ERC20')[]>([]);
const [loadingCurrencies, setLoadingCurrencies] = useState(true);
const [skipSelection, setSkipSelection] = useState(false);
```

---

### Step 2: Add useEffect to Fetch Configured Currencies

Add this useEffect after state declarations:

```tsx
// Fetch merchant's configured currencies on mount
useEffect(() => {
  const fetchConfiguredCurrencies = async () => {
    try {
      setLoadingCurrencies(true);
      const response = await axiosBaseApi.get("/pay/configured-currencies");
      const { configured_currencies, skip_selection } = response.data.data;
      
      // Separate base currencies and USDT networks
      const baseCurrencies: string[] = [];
      const usdtNetworks: ('TRC20' | 'ERC20')[] = [];
      
      configured_currencies.forEach((currency: string) => {
        if (currency === 'USDT-TRC20') {
          if (!baseCurrencies.includes('USDT')) baseCurrencies.push('USDT');
          usdtNetworks.push('TRC20');
        } else if (currency === 'USDT-ERC20') {
          if (!baseCurrencies.includes('USDT')) baseCurrencies.push('USDT');
          usdtNetworks.push('ERC20');
        } else {
          baseCurrencies.push(currency);
        }
      });
      
      setAvailableCryptos(baseCurrencies);
      setAvailableUSDTNetworks(usdtNetworks);
      setSkipSelection(skip_selection);
      
      // Auto-select if only one currency
      if (skip_selection && baseCurrencies.length === 1) {
        const currency = baseCurrencies[0];
        if (currency === 'USDT' && usdtNetworks.length === 1) {
          setSelectedCrypto('USDT');
          setIsNetwork('USDT');
          setTimeout(() => handleNetworkChange(usdtNetworks[0]), 100);
        } else if (currency !== 'USDT') {
          setTimeout(() => getCurrencyRateAndSubmit(currency), 100);
        }
      }
    } catch (e: any) {
      console.error("Failed to fetch configured currencies:", e);
      // Fallback: show all currencies
      setAvailableCryptos(['USDT', 'BTC', 'ETH', 'LTC', 'DOGE', 'BCH', 'TRX']);
      setAvailableUSDTNetworks(['TRC20', 'ERC20']);
    } finally {
      setLoadingCurrencies(false);
    }
  };
  
  fetchConfiguredCurrencies();
}, []);
```

---

### Step 3: Create Filtered Options

Add this after the useEffect:

```tsx
// Filter crypto options based on merchant config
const filteredCryptoOptions = cryptoOptions.filter(opt => 
  availableCryptos.includes(opt.value)
);
```

---

### Step 4: Update the Select Dropdown

Replace the existing `<FormControl>` section with:

```tsx
{loadingCurrencies ? (
  <Box display="flex" alignItems="center" justifyContent="center" p={2}>
    <CircularProgress size={24} />
    <Typography ml={2} fontFamily="Space Grotesk" color="#515151">
      Loading available currencies...
    </Typography>
  </Box>
) : filteredCryptoOptions.length === 0 ? (
  <Box p={2} textAlign="center" bgcolor="#FEF2F2" borderRadius={2}>
    <Typography color="#DC2626" fontFamily="Space Grotesk" fontWeight={500}>
      No cryptocurrencies available
    </Typography>
    <Typography variant="body2" color="#515151" fontFamily="Space Grotesk" mt={1}>
      The merchant has not configured any crypto wallets.
    </Typography>
  </Box>
) : (
  <FormControl fullWidth>
    <Select
      labelId="crypto-select-label"
      id="crypto-select"
      value={selectedCrypto}
      displayEmpty
      onChange={handleChange}
      IconComponent={KeyboardArrowDownIcon}
      sx={{
        "& .MuiOutlinedInput-input": {
          borderRadius: "10px !important",
          borderColor: "#737373 !important",
          py: "16.5px !important",
        },
        "& fieldset": {
          borderRadius: "10px !important",
          borderColor: "#737373 !important",
        },
      }}
      MenuProps={{
        PaperProps: {
          sx: {
            py: "10px",
            px: "20px",
            backgroundColor: "#fff",
            border: "1px solid #737373",
            boxShadow: 3,
            borderRadius: "10px",
          },
        },
      }}
      renderValue={(selected) => {
        if (!selected)
          return (
            <span style={{ color: "#1A1919", fontWeight: 500, fontFamily: "Space Grotesk" }}>
              Select Crypto Type
            </span>
          );
        const option = getSelectedOption();
        return (
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, color: "#1A1919", fontWeight: "medium", height: "24px" }}>
            {option?.icon}
            {option?.label}
          </Box>
        );
      }}
    >
      {filteredCryptoOptions.map((option) => (
        <MenuItem
          key={option.value}
          value={option.value}
          sx={{
            borderRadius: "8px",
            "&:hover": { backgroundColor: "#F5F8FF" },
            "&.Mui-selected": { backgroundColor: "#F5F8FF" },
            padding: "10px",
          }}
        >
          <ListItemIcon style={{ height: "26px", width: "25px" }}>
            {option.icon}
          </ListItemIcon>
          <ListItemText>{option.label}</ListItemText>
        </MenuItem>
      ))}
    </Select>
  </FormControl>
)}
```

---

### Step 5: Update USDT Network Selection

Replace the existing network selection section with:

```tsx
{/* USDT Network Selection - Only show configured networks */}
{isNetwork === "USDT" && availableUSDTNetworks.length > 0 && (
  <>
    <Box mt={1}>
      <Typography
        variant="subtitle2"
        fontWeight={500}
        fontFamily="Space Grotesk"
        color="#000"
      >
        Preferred Network
      </Typography>
    </Box>

    <Box mt={"10px"} mb={3} display="flex" gap={1} alignItems="center">
      {availableUSDTNetworks.map((net) => (
        <Typography
          key={net}
          border={`1px solid ${selectedNetwork === net ? "#86A4F9" : "#E7EAFD"}`}
          padding="5px 10px"
          fontSize="small"
          bgcolor={selectedNetwork === net ? "#E7EAFD" : "#F5F8FF"}
          borderRadius="5px"
          sx={{ cursor: "pointer" }}
          onClick={() => handleNetworkChange(net)}
          fontFamily="Space Grotesk"
        >
          {net}
        </Typography>
      ))}
    </Box>
  </>
)}

{/* Show message if USDT selected but no networks configured */}
{isNetwork === "USDT" && availableUSDTNetworks.length === 0 && (
  <Box mt={2} p={2} bgcolor="#FEF3C7" borderRadius={1}>
    <Typography color="#92400E" fontSize="small" fontFamily="Space Grotesk">
      USDT networks are not configured. Please select another currency.
    </Typography>
  </Box>
)}
```

---

## Complete Changes Summary

| Line | Action | Code |
|------|--------|------|
| ~85 | Add states | `availableCryptos`, `availableUSDTNetworks`, `loadingCurrencies`, `skipSelection` |
| ~90 | Add useEffect | Fetch `/wallet/configured-currencies` on mount |
| ~130 | Add filter | `filteredCryptoOptions` computed from `availableCryptos` |
| ~200 | Update Select | Show loading/error/filtered dropdown |
| ~280 | Update Networks | Only show configured USDT networks |

---

## Testing

1. **Merchant with BTC + ETH only:**
   - Dropdown shows only BTC and ETH
   - USDT option not visible

2. **Merchant with USDT-TRC20 only:**
   - Dropdown shows USDT
   - Network selection only shows TRC20

3. **Merchant with all currencies:**
   - All options visible
   - Both USDT networks available

4. **Merchant with single currency:**
   - Auto-selects that currency
   - Skips dropdown selection
