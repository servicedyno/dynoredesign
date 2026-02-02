# Checkout Page Enhancement Recommendations

## Current State Analysis

### Backend getData Response (Already Available)
The backend `POST /api/pay/getData` already returns these fields:
```json
{
  "amount": 50.00,
  "base_currency": "USD",
  "token": "...",
  "payment_mode": "createLink",
  "allowedModes": "CRYPTO",
  "fee_payer": "company",
  "transaction_id": "uuid-here",
  "order_reference": "INV-2026-xxx",        // ✅ Invoice number
  "description": "Monthly subscription",     // ✅ Purchase description
  "merchant": {
    "company_name": "Acme Store",
    "company_logo": null
  },
  "fee_info": {
    "fee_payer": "company",
    "processing_fee": 4.00,                  // Available if customer pays
    "total_amount": 54.00
  },
  "expiry": {                                // ✅ Link expiry info
    "expires_at": "2026-02-07T15:00:00.000Z",
    "is_expired": false,
    "countdown": {
      "days": 7,
      "hours": 0,
      "minutes": 30,
      "seconds": 15,
      "formatted": "7d : 00h : 30m : 15s"
    }
  },
  "redirect_url": "https://merchant.com/success"
}
```

### Current Checkout UI Issues
1. **Generic Title**: "Your order is almost complete!" - doesn't fit all use cases
2. **Missing Description**: Purchase description not displayed
3. **Missing Invoice**: Order reference not shown prominently
4. **No Expiry Warning**: Link expiry not displayed
5. **No Tax Display**: Sales tax not shown even if configured
6. **No Merchant Branding**: Company name/logo not utilized

---

## Recommended Changes

### Files to Modify

| File | Purpose |
|------|---------|
| `pages/pay/index.tsx` | Main payment page - add new state and UI sections |
| `public/locales/en/common.json` | Translation strings |
| `public/locales/pt/common.json` | Portuguese translations |
| `Components/UI/OrderSummary.tsx` | **NEW** - Order summary component |
| `Components/UI/ExpiryCountdown.tsx` | **NEW** - Countdown timer component |

---

## Detailed Changes

### 1. `pages/pay/index.tsx` - State Changes

Add new state variables after existing ones (around line 88):

```typescript
// Existing states...
const [linkId, setLinkId] = useState<string>('')

// NEW: Add these state variables
const [description, setDescription] = useState<string | null>(null)
const [orderReference, setOrderReference] = useState<string | null>(null)
const [merchantInfo, setMerchantInfo] = useState<{
  company_name: string | null;
  company_logo: string | null;
} | null>(null)
const [expiryInfo, setExpiryInfo] = useState<{
  expires_at: string;
  is_expired: boolean;
  countdown: {
    days: number;
    hours: number;
    minutes: number;
    seconds: number;
    formatted: string;
  } | null;
} | null>(null)
const [redirectUrl, setRedirectUrl] = useState<string | null>(null)
const [feeInfo, setFeeInfo] = useState<{
  fee_payer: string;
  processing_fee?: number;
  total_amount?: number;
} | null>(null)
```

### 2. `pages/pay/index.tsx` - getQueryData Changes

Update the `getQueryData` function to capture new fields:

```typescript
const getQueryData = async () => {
  try {
    const query_data = router.query.d
    const {
      data: { data }
    }: { data: any } = await axiosBaseApi.post('pay/getData', {
      data: query_data
    })
    
    // Existing code...
    setWalletState({
      amount: Number(data.amount),
      currency: data.base_currency
    })
    setPaymentMode(data.payment_mode)
    if (data?.payment_mode === 'createLink') {
      setAllowedModes(data?.allowedModes?.split(','))
    }
    localStorage.setItem('token', data.token)
    const tempToken: any = jwt.decode(data.token)
    setTokenData(tempToken)
    setFeePayer(data.fee_payer || '')
    setLinkId(tempToken?.transaction_id || '')

    // NEW: Capture enhanced checkout data
    setDescription(data.description || null)
    setOrderReference(data.order_reference || null)
    setMerchantInfo(data.merchant || null)
    setExpiryInfo(data.expiry || null)
    setRedirectUrl(data.redirect_url || null)
    setFeeInfo(data.fee_info || null)

    // Check if link is expired
    if (data.expiry?.is_expired) {
      dispatch({
        type: TOAST_SHOW,
        payload: {
          message: t('checkout.linkExpired'),
          severity: 'error'
        }
      })
      // Optionally redirect or show expired state
    }

    // ... rest of existing code
  } catch (e: any) {
    // ... existing error handling
  }
}
```

### 3. `pages/pay/index.tsx` - UI Changes

Replace the current Paper content with enhanced UI:

```tsx
<Paper
  elevation={3}
  sx={{
    borderRadius: 4,
    p: 4,
    width: '100%',
    maxWidth: 500,
    // ... existing styles
  }}
>
  {/* Merchant Branding */}
  <Box display='flex' justifyContent='center' mb={2}>
    {merchantInfo?.company_logo ? (
      <Image 
        src={merchantInfo.company_logo} 
        alt={merchantInfo.company_name || 'Merchant'} 
        width={120} 
        height={40}
        style={{ objectFit: 'contain' }}
      />
    ) : (
      <Logo />
    )}
  </Box>

  {/* Dynamic Title - Context-Aware */}
  <Typography
    fontWeight={500}
    fontSize={25}
    lineHeight='98%'
    gutterBottom
    fontFamily='Space Grotesk'
    color={theme.palette.text.primary}
  >
    {description 
      ? t('checkout.titleWithDescription') 
      : t('checkout.titleGeneric')}
  </Typography>

  {/* Subtitle - Context-Aware */}
  <Typography
    color={isDark ? theme.palette.text.secondary : '#000'}
    fontWeight={400}
    fontSize={14}
    lineHeight='18px'
    mb={2}
    fontFamily='Space Grotesk'
  >
    {merchantInfo?.company_name 
      ? t('checkout.subtitleWithMerchant', { merchant: merchantInfo.company_name })
      : t('checkout.subtitleGeneric')}
  </Typography>

  {/* Order Summary Section - NEW */}
  {(description || orderReference) && (
    <Box
      sx={{
        backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#F9FAFB',
        borderRadius: '8px',
        p: 2,
        mb: 2,
        textAlign: 'left'
      }}
    >
      {/* Purchase Description */}
      {description && (
        <Box mb={orderReference ? 1.5 : 0}>
          <Typography
            variant='caption'
            color={isDark ? theme.palette.text.secondary : '#6B7280'}
            fontWeight={500}
            fontSize={11}
            textTransform='uppercase'
            letterSpacing={0.5}
          >
            {t('checkout.orderDescription')}
          </Typography>
          <Typography
            color={theme.palette.text.primary}
            fontWeight={500}
            fontSize={14}
            fontFamily='Space Grotesk'
            mt={0.5}
          >
            {description}
          </Typography>
        </Box>
      )}
      
      {/* Invoice/Order Reference */}
      {orderReference && (
        <Box display='flex' justifyContent='space-between' alignItems='center'>
          <Box>
            <Typography
              variant='caption'
              color={isDark ? theme.palette.text.secondary : '#6B7280'}
              fontWeight={500}
              fontSize={11}
              textTransform='uppercase'
              letterSpacing={0.5}
            >
              {t('checkout.invoiceNumber')}
            </Typography>
            <Typography
              color={theme.palette.text.primary}
              fontWeight={600}
              fontSize={14}
              fontFamily='Space Grotesk'
              mt={0.5}
            >
              {orderReference}
            </Typography>
          </Box>
          <Tooltip title={t('common.copy')}>
            <IconButton
              size='small'
              onClick={() => {
                navigator.clipboard.writeText(orderReference)
                dispatch({
                  type: TOAST_SHOW,
                  payload: { message: t('common.copied'), severity: 'success' }
                })
              }}
              sx={{
                bgcolor: isDark ? '#2a2a4a' : '#E7EAFD',
                '&:hover': { bgcolor: isDark ? '#3a3a5a' : '#E0E7FF' }
              }}
            >
              <CopyIcon />
            </IconButton>
          </Tooltip>
        </Box>
      )}
    </Box>
  )}

  {/* Payment Amount Section */}
  <Box
    alignItems='center'
    border={`1px solid ${isDark ? theme.palette.surface.border : '#DFDFDF'}`}
    borderRadius={'10px'}
    px='21px'
    py='18px'
    sx={{ transition: 'border-color 0.3s ease' }}
  >
    {/* Amount Breakdown */}
    <Box mb={2}>
      {/* Subtotal */}
      <Box display='flex' justifyContent='space-between' alignItems='center' mb={1}>
        <Typography
          variant='body2'
          color={isDark ? theme.palette.text.secondary : '#6B7280'}
          fontFamily='Space Grotesk'
        >
          {t('checkout.subtotal')}
        </Typography>
        <Typography
          fontWeight={500}
          fontFamily='Space Grotesk'
          color={theme.palette.text.primary}
        >
          {walletState?.currency} {Number(walletState?.amount).toFixed(2)}
        </Typography>
      </Box>

      {/* Processing Fee (if customer pays) */}
      {feeInfo?.fee_payer === 'customer' && feeInfo?.processing_fee && (
        <Box display='flex' justifyContent='space-between' alignItems='center' mb={1}>
          <Typography
            variant='body2'
            color={isDark ? theme.palette.text.secondary : '#6B7280'}
            fontFamily='Space Grotesk'
          >
            {t('checkout.processingFee')}
          </Typography>
          <Typography
            fontWeight={500}
            fontFamily='Space Grotesk'
            color={theme.palette.text.primary}
          >
            {walletState?.currency} {feeInfo.processing_fee.toFixed(2)}
          </Typography>
        </Box>
      )}

      {/* TODO: Sales Tax (if merchant enabled) */}
      {/* This requires backend changes to include tax_amount in getData response */}
      {/* 
      {taxInfo?.enabled && (
        <Box display='flex' justifyContent='space-between' alignItems='center' mb={1}>
          <Typography variant='body2' color='text.secondary'>
            {t('checkout.salesTax')} ({taxInfo.rate}%)
          </Typography>
          <Typography fontWeight={500}>
            {walletState?.currency} {taxInfo.amount.toFixed(2)}
          </Typography>
        </Box>
      )}
      */}
    </Box>

    <Divider sx={{ mb: 2, borderColor: isDark ? theme.palette.surface.border : undefined }} />

    {/* Total To Pay */}
    <Box display='flex' justifyContent='space-between' alignItems='center' mb={2}>
      <Typography
        variant='subtitle2'
        fontFamily='Space Grotesk'
        fontWeight={600}
        fontSize={16}
        color={theme.palette.text.primary}
      >
        {t('checkout.totalToPay')}
      </Typography>
      
      {/* Currency selector with total */}
      <Box
        display='flex'
        alignItems='center'
        // ... existing currency selector styles
      >
        {/* ... existing currency selector code */}
      </Box>
    </Box>

    {/* Payment Method Buttons */}
    <Box display='flex' gap={2}>
      {/* ... existing buttons */}
    </Box>
  </Box>

  {/* Expiry Warning - NEW */}
  {expiryInfo && !expiryInfo.is_expired && expiryInfo.countdown && (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 1,
        mt: 2,
        p: 1.5,
        backgroundColor: isDark ? 'rgba(251, 188, 5, 0.1)' : '#FEF3C7',
        borderRadius: '8px',
        border: `1px solid ${isDark ? 'rgba(251, 188, 5, 0.3)' : '#FCD34D'}`
      }}
    >
      <Icon icon='mdi:clock-outline' width={18} color='#F59E0B' />
      <Typography
        variant='caption'
        fontFamily='Space Grotesk'
        fontWeight={500}
        color={isDark ? '#FCD34D' : '#B45309'}
      >
        {t('checkout.expiresIn', { time: expiryInfo.countdown.formatted })}
      </Typography>
    </Box>
  )}

  {/* Link Expired State */}
  {expiryInfo?.is_expired && (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 1,
        mt: 2,
        p: 1.5,
        backgroundColor: isDark ? 'rgba(239, 68, 68, 0.1)' : '#FEE2E2',
        borderRadius: '8px',
        border: `1px solid ${isDark ? 'rgba(239, 68, 68, 0.3)' : '#FCA5A5'}`
      }}
    >
      <Icon icon='mdi:clock-alert-outline' width={18} color='#EF4444' />
      <Typography
        variant='caption'
        fontFamily='Space Grotesk'
        fontWeight={500}
        color={isDark ? '#FCA5A5' : '#B91C1C'}
      >
        {t('checkout.linkExpiredMessage')}
      </Typography>
    </Box>
  )}

  {/* Transaction ID Footer */}
  <Box display='flex' justifyContent='space-between' mt={3}>
    {/* ... existing transaction ID display */}
  </Box>
</Paper>
```

### 4. Translation File Updates

#### `public/locales/en/common.json`

```json
{
  "header": {
    "wallet": "Dynopay Wallet",
    "language": "EN"
  },
  "checkout": {
    "titleGeneric": "Complete Your Payment",
    "titleWithDescription": "Review Your Order",
    "subtitleGeneric": "Choose a payment method below to complete your transaction",
    "subtitleWithMerchant": "Complete your payment to {{merchant}}",
    "orderDescription": "Order Details",
    "invoiceNumber": "Invoice / Reference",
    "subtotal": "Subtotal",
    "processingFee": "Processing Fee",
    "salesTax": "Sales Tax",
    "totalToPay": "Total to Pay",
    "toPay": "Amount",
    "bankTransfer": "Bank Transfer",
    "bank": "Bank",
    "cryptocurrency": "Cryptocurrency",
    "crypto": "Crypto",
    "transactionIdNote": "Save your Transaction ID to continue later:",
    "loading": "Loading...",
    "expiresIn": "Link expires in {{time}}",
    "linkExpired": "This payment link has expired",
    "linkExpiredMessage": "This payment link has expired. Please request a new one.",
    "securePayment": "Secure payment powered by DynoPay"
  },
  "currency": {
    "USD": "United States Dollar (USD)",
    "EUR": "Euro (EUR)",
    "NGN": "Nigerian Naira (NGN)"
  },
  "footer": {
    "termsOfService": "Terms Of Service",
    "amlPolicy": "AML Policy"
  },
  "common": {
    "copy": "Copy",
    "copied": "Copied to clipboard!",
    "back": "Back",
    "continue": "Continue",
    "submit": "Submit",
    "cancel": "Cancel"
  }
}
```

#### `public/locales/pt/common.json`

```json
{
  "header": {
    "wallet": "Carteira Dynopay",
    "language": "PT"
  },
  "checkout": {
    "titleGeneric": "Complete o Seu Pagamento",
    "titleWithDescription": "Reveja o Seu Pedido",
    "subtitleGeneric": "Escolha um método de pagamento abaixo para completar a transação",
    "subtitleWithMerchant": "Complete o pagamento para {{merchant}}",
    "orderDescription": "Detalhes do Pedido",
    "invoiceNumber": "Fatura / Referência",
    "subtotal": "Subtotal",
    "processingFee": "Taxa de Processamento",
    "salesTax": "IVA",
    "totalToPay": "Total a Pagar",
    "toPay": "Valor",
    "bankTransfer": "Transferência Bancária",
    "bank": "Banco",
    "cryptocurrency": "Criptomoeda",
    "crypto": "Cripto",
    "transactionIdNote": "Guarde o ID da transação para continuar mais tarde:",
    "loading": "A carregar...",
    "expiresIn": "Link expira em {{time}}",
    "linkExpired": "Este link de pagamento expirou",
    "linkExpiredMessage": "Este link de pagamento expirou. Por favor, solicite um novo.",
    "securePayment": "Pagamento seguro via DynoPay"
  },
  "currency": {
    "USD": "Dólar Americano (USD)",
    "EUR": "Euro (EUR)",
    "NGN": "Naira Nigeriana (NGN)"
  },
  "footer": {
    "termsOfService": "Termos de Serviço",
    "amlPolicy": "Política AML"
  },
  "common": {
    "copy": "Copiar",
    "copied": "Copiado!",
    "back": "Voltar",
    "continue": "Continuar",
    "submit": "Submeter",
    "cancel": "Cancelar"
  }
}
```

---

## Backend Changes Required for Sales Tax

To support sales tax display, the backend `getData` response needs to include tax information. 

### Update `/app/backend/controller/paymentController.ts`

In the `getData` function, add tax calculation if merchant has tax enabled:

```typescript
// After getting companyInfo, check if tax is enabled
let taxInfo = null;
if (item.company_id) {
  try {
    // Get company's tax configuration
    const [companyTaxConfig] = await sequelize.query(
      `SELECT tax_enabled, default_tax_rate, tax_country_code 
       FROM tbl_company WHERE company_id = :company_id`,
      { replacements: { company_id: item.company_id }, type: QueryTypes.SELECT }
    );
    
    if (companyTaxConfig?.tax_enabled && companyTaxConfig?.default_tax_rate) {
      const taxRate = Number(companyTaxConfig.default_tax_rate);
      const taxAmount = (amount * taxRate) / 100;
      taxInfo = {
        enabled: true,
        rate: taxRate,
        amount: parseFloat(taxAmount.toFixed(2)),
        country_code: companyTaxConfig.tax_country_code
      };
    }
  } catch (taxError) {
    console.warn('[getData] Failed to fetch tax config:', taxError);
  }
}

// Include in payload
payload = {
  // ... existing fields
  tax_info: taxInfo,
};
```

### Database Schema Addition

Add tax columns to `tbl_company` if not exists:

```sql
ALTER TABLE tbl_company ADD COLUMN IF NOT EXISTS tax_enabled BOOLEAN DEFAULT false;
ALTER TABLE tbl_company ADD COLUMN IF NOT EXISTS default_tax_rate DECIMAL(5,2) DEFAULT 0;
ALTER TABLE tbl_company ADD COLUMN IF NOT EXISTS tax_country_code VARCHAR(2);
```

---

## Visual Mockup - Before vs After

### BEFORE (Current)
```
┌─────────────────────────────────────┐
│            [Logo]                    │
│                                      │
│   Your order is almost complete!     │
│   Choose a payment method below...   │
│                                      │
│  ┌─────────────────────────────────┐ │
│  │ To Pay:           $50.00 USD ▼ │ │
│  ├─────────────────────────────────┤ │
│  │ [Bank Transfer] [Cryptocurrency]│ │
│  └─────────────────────────────────┘ │
│                                      │
│  Transaction ID: #abc123...          │
└─────────────────────────────────────┘
```

### AFTER (Enhanced)
```
┌─────────────────────────────────────┐
│         [Merchant Logo]              │
│                                      │
│       Review Your Order              │
│   Complete payment to Acme Store     │
│                                      │
│  ┌─────────────────────────────────┐ │
│  │ ORDER DETAILS                   │ │
│  │ Monthly Pro Subscription        │ │
│  │                                 │ │
│  │ INVOICE / REFERENCE             │ │
│  │ INV-2026-A1B2C3          [Copy] │ │
│  └─────────────────────────────────┘ │
│                                      │
│  ┌─────────────────────────────────┐ │
│  │ Subtotal              $50.00   │ │
│  │ Processing Fee         $4.00   │ │
│  │ Sales Tax (23%)       $11.50   │ │
│  ├─────────────────────────────────┤ │
│  │ Total to Pay     $65.50 USD ▼  │ │
│  ├─────────────────────────────────┤ │
│  │ [Bank Transfer] [Cryptocurrency]│ │
│  └─────────────────────────────────┘ │
│                                      │
│  ⏰ Link expires in 6d : 23h : 45m   │
│                                      │
│  Transaction ID: #abc123...          │
│                                      │
│  🔒 Secure payment powered by DynoPay│
└─────────────────────────────────────┘
```

---

## Summary of Changes

| Component | Change | Priority |
|-----------|--------|----------|
| **Title/Subtitle** | Context-aware messaging | High |
| **Order Description** | Display purchase details | High |
| **Invoice Number** | Show order_reference prominently | High |
| **Expiry Warning** | Countdown timer with visual alert | High |
| **Amount Breakdown** | Subtotal, fees, taxes itemized | Medium |
| **Merchant Branding** | Company logo if available | Medium |
| **Sales Tax** | Display if merchant enabled (requires backend) | Low |
| **Translation Updates** | New i18n keys for all new text | High |

Would you like me to implement any of these changes in the backend first, or provide more detailed code for a specific component?
