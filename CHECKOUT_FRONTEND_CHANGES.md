# DynoCheckoutFIX Frontend - Required Changes

## Repository: https://github.com/Moxxcompany/DynoCheckoutFIX
## Branch: Payment-Status-Fix

---

## Issue 1: Fee Calculation Not Including Customer Fees

### Problem
When `fee_payer: "customer"` is set on a payment link, the checkout page displays only the base amount ($10) instead of the total amount including fees ($10 + fees).

### Root Cause
The `getCurrencyRates` API call in `cryptoTransfer.tsx` does NOT pass the `fee_payer` parameter from the payment data.

### Files to Modify

#### File: `pages/pay/index.tsx`

**Change 1:** Store `fee_payer` from the `getData` response.

```typescript
// Around line 73, add fee_payer to state
const [feePayer, setFeePayer] = useState<string>('company');
```

**Change 2:** In `getQueryData()` function (around line 90-115), save the `fee_payer`:

```typescript
const getQueryData = async () => {
  try {
    const query_data = router.query.d
    const {
      data: { data }
    }: { data: any } = await axiosBaseApi.post('pay/getData', {
      data: query_data
    })
    setWalletState({
      amount: data.amount,
      currency: data.base_currency
    })
    setPaymentMode(data.payment_mode)
    setFeePayer(data.fee_payer || 'company')  // <-- ADD THIS LINE
    
    if (data?.payment_mode === 'createLink') {
      setAllowedModes(data?.allowedModes?.split(','))
    }
    // ... rest of the function
  }
}
```

**Change 3:** Pass `feePayer` to `CryptoTransfer` component (around line 440):

```tsx
<CryptoTransfer
  activeStep={activeStep}
  setActiveStep={setActiveStep}
  walletState={walletState}
  feePayer={feePayer}  // <-- ADD THIS PROP
/>
```

---

#### File: `Components/Page/Pay3Components/cryptoTransfer.tsx`

**Change 1:** Update the interface to accept `feePayer` prop (around line 50-55):

```typescript
interface CryptoTransferProps {
  activeStep: number;
  setActiveStep: React.Dispatch<React.SetStateAction<number>>;
  walletState: walletState;
  feePayer?: string;  // <-- ADD THIS
}
```

**Change 2:** Destructure `feePayer` in the component (around line 65):

```typescript
const CryptoTransfer = ({
  activeStep,
  setActiveStep,
  walletState,
  feePayer = 'company',  // <-- ADD THIS with default
}: CryptoTransferProps) => {
```

**Change 3:** Update `getCurrencyRateAndSubmit` function to pass `fee_payer` (around line 170-210):

```typescript
const getCurrencyRateAndSubmit = async (
  cryptoValue: string,
  network: "TRC20" | "ERC20" = "TRC20"
) => {
  try {
    setLoading(true);

    const displayCurrency =
      cryptoValue === "USDT" ? `USDT-${network}` : cryptoValue;

    const baseCurrency =
      cryptoValue === "USDT"
        ? "USDT"
        : cryptoOptions.find((x) => x.value === cryptoValue)?.currency || "";

    console.log("displayCurrency:", displayCurrency);
    console.log("baseCurrency (lookup key):", baseCurrency);
    console.log("feePayer:", feePayer);  // <-- ADD for debugging

    const rateResponse = await axiosBaseApi.post("/pay/getCurrencyRates", {
      source: walletState?.currency,
      amount: walletState?.amount,
      currencyList: cryptoOptions.map((x) => x.value),
      fixedDecimal: false,
      fee_payer: feePayer,  // <-- ADD THIS LINE
    });

    const rateData = rateResponse?.data?.data;

    // When fee_payer is 'customer', the API returns total_amount instead of amount
    const findRate = rateData?.find(
      (item: any) => item.currency === baseCurrency
    );

    // Use total_amount if available (customer pays fees), otherwise use amount
    if (findRate && feePayer === 'customer' && findRate.total_amount) {
      findRate.amount = findRate.total_amount;  // <-- ADD: Use total amount when customer pays
    }

    setCurrencyRates(rateData);
    setSelectedCurrency(findRate);
    setSelectedCrypto(cryptoValue);

    const finalPayload = {
      currency: displayCurrency,
      amount: findRate?.amount,  // This now includes fees when customer pays
      paymentType: paymentTypes.CRYPTO,
    };

    // ... rest of the function
  }
}
```

---

## Issue 2: Display Link ID Instead of "#ABC123456"

### Problem
The checkout page shows a hardcoded `#ABC123456` instead of the actual payment Link ID.

### Files to Modify

#### File: `pages/pay/index.tsx`

**Change 1:** Store the link ID from `getData` response. Add new state (around line 73):

```typescript
const [linkId, setLinkId] = useState<string>('');
```

**Change 2:** In `getQueryData()`, extract the transaction_id from token or response:

```typescript
const getQueryData = async () => {
  try {
    const query_data = router.query.d
    const {
      data: { data }
    }: { data: any } = await axiosBaseApi.post('pay/getData', {
      data: query_data
    })
    
    // ... existing code ...
    
    localStorage.setItem('token', data.token)
    const tempToken: any = jwt.decode(data.token)
    setTokenData(tempToken)
    
    // Extract and set link ID from token or use query parameter
    if (tempToken?.transaction_id) {
      setLinkId(tempToken.transaction_id);
    } else if (typeof query_data === 'string') {
      // Use first 12 chars of encrypted data as reference
      setLinkId(query_data.substring(0, 12).toUpperCase());
    }
    
    setLoading(false)
  } catch (e: any) {
    // ... error handling
  }
}
```

**Change 3:** Replace hardcoded `#ABC123456` with actual link ID (around line 380-390):

Find this section:
```tsx
<Box display='flex' alignItems='center' gap={1}>
  <Typography
    variant='caption'
    fontWeight={500}
    fontSize={12}
    color='#515151'
  >
    #ABC123456
  </Typography>
```

Replace with:
```tsx
<Box display='flex' alignItems='center' gap={1}>
  <Typography
    variant='caption'
    fontWeight={500}
    fontSize={12}
    color='#515151'
  >
    #{linkId || 'Loading...'}
  </Typography>
```

**Change 4:** Update the copy button to copy the actual link ID (around line 395):

Find:
```tsx
<Tooltip title='Copy'>
  <IconButton
    size='small'
    sx={{
      bgcolor: '#E7EAFD',
      p: 0.5,
      height: '24px',
      width: '24px',
      borderRadius: '5px',
      '&:hover': { bgcolor: '#E0E7FF' }
    }}
  >
    <CopyIcon />
  </IconButton>
</Tooltip>
```

Replace with:
```tsx
<Tooltip title={copied ? 'Copied!' : 'Copy'}>
  <IconButton
    size='small'
    onClick={() => {
      if (linkId) {
        navigator.clipboard.writeText(linkId);
        // Optional: Add a state to show "Copied!" feedback
      }
    }}
    sx={{
      bgcolor: '#E7EAFD',
      p: 0.5,
      height: '24px',
      width: '24px',
      borderRadius: '5px',
      '&:hover': { bgcolor: '#E0E7FF' }
    }}
  >
    <CopyIcon />
  </IconButton>
</Tooltip>
```

---

## Summary of All Changes

### `pages/pay/index.tsx`
1. Add `feePayer` state: `const [feePayer, setFeePayer] = useState<string>('company');`
2. Add `linkId` state: `const [linkId, setLinkId] = useState<string>('');`
3. In `getQueryData()`: Save `fee_payer` and extract `linkId`
4. Pass `feePayer` prop to `<CryptoTransfer />`
5. Replace `#ABC123456` with `#{linkId || 'Loading...'}`
6. Add onClick handler to copy button for link ID

### `Components/Page/Pay3Components/cryptoTransfer.tsx`
1. Add `feePayer?: string` to `CryptoTransferProps` interface
2. Destructure `feePayer` with default value in component
3. Add `fee_payer: feePayer` to `getCurrencyRates` API call
4. Use `total_amount` when `fee_payer === 'customer'`

---

## Testing

After making changes:

1. **Test Fee Calculation:**
   - Create a payment link with `fee_payer: "customer"` 
   - Open the checkout page
   - Select a cryptocurrency
   - Verify the amount shown includes fees (should be > $10 for a $10 payment)

2. **Test Link ID Display:**
   - Open any payment link
   - Verify the Transaction ID section shows actual ID instead of `#ABC123456`
   - Click copy button and verify correct ID is copied

---

## API Response Reference

### `GET /api/pay/getData` Response:
```json
{
  "amount": 10,
  "base_currency": "USD",
  "token": "eyJ...",
  "payment_mode": "createLink",
  "allowedModes": "CRYPTO",
  "fee_payer": "customer"  // <-- This field indicates who pays fees
}
```

### `POST /api/pay/getCurrencyRates` Request (with fee_payer):
```json
{
  "source": "USD",
  "amount": 10,
  "currencyList": ["BTC", "ETH", "USDT"],
  "fixedDecimal": false,
  "fee_payer": "customer"  // <-- ADD THIS
}
```

### `POST /api/pay/getCurrencyRates` Response (when fee_payer is "customer"):
```json
{
  "data": [
    {
      "currency": "BTC",
      "amount": 0.000105,      // Base amount
      "total_amount": 0.000112, // Total including fees (USE THIS)
      "fee_payer": "customer",
      "fees": {
        "transaction_fee_usd": 0.20,
        "fixed_fee_usd": 3.00,
        "network_fee_usd": 0.50
      }
    }
  ]
}
```

When `fee_payer: "customer"`, use `total_amount` instead of `amount` for display and payment.
