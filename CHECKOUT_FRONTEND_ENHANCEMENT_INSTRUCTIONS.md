# Checkout Frontend Enhancement Instructions

## Overview

This document provides comprehensive instructions for enhancing the DynocheckoutDarkMode checkout page to display:
1. Purchase description
2. Invoice/Order reference number
3. Processing fee breakdown (and who pays it)
4. Sales tax (when merchant enabled)
5. Link expiry countdown
6. Better messaging for e-commerce and creator payments

All data is **already available** from the backend `getData` response - the frontend just needs to capture and display it.

---

## Backend getData Response Structure

```typescript
interface GetDataResponse {
  // Basic payment info
  amount: number;                    // Base amount (without tax/fees)
  base_currency: string;             // EUR, USD, etc.
  token: string;                     // JWT for authentication
  payment_mode: string;              // 'createLink', 'payment', etc.
  allowedModes: string;              // 'CRYPTO,BANK' comma-separated
  
  // NEW: Order details
  transaction_id: string;            // Unique payment ID
  order_reference: string;           // Invoice number: "INV-2026-A1B2C3"
  description: string | null;        // Purchase description
  created_at: string;                // ISO timestamp
  
  // NEW: Merchant info
  merchant: {
    company_name: string | null;
    company_logo: string | null;     // URL to logo image
  } | null;
  
  // NEW: Fee information
  fee_payer: string;                 // 'customer' or 'company'
  fee_info: {
    fee_payer: string;
    processing_fee?: number;         // Only if customer pays
    total_amount?: number;           // Only if customer pays
  };
  
  // NEW: Expiry information
  expiry: {
    expires_at: string;              // ISO timestamp
    is_expired: boolean;
    countdown: {
      days: number;
      hours: number;
      minutes: number;
      seconds: number;
      formatted: string;             // "7d : 00h : 30m : 15s"
    } | null;
  } | null;
  
  // NEW: Tax information (only if apply_tax: true)
  apply_tax: boolean;
  tax_info?: {
    tax_enabled: boolean;
    tax_rate: number;                // e.g., 23
    tax_acronym: string;             // "VAT", "IVA", "GST"
    tax_amount: number;              // Calculated tax
    country_code: string;            // "PT", "DE", etc.
    country_name: string;            // "Portugal", "Germany"
    subtotal: number;                // Base amount
    total: number;                   // Base + tax
    currency: string;
  };
  
  // Post-payment settings
  redirect_url?: string;             // Where to redirect after success
}
```

---

## File Changes Required

### 1. `pages/pay/index.tsx` - Main Payment Page

#### 1.1 Add New State Variables

After the existing state declarations (around line 88), add:

```typescript
// Existing states
const [feePayer, setFeePayer] = useState<string>('')
const [linkId, setLinkId] = useState<string>('')

// NEW: Enhanced checkout data states
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
const [feeInfo, setFeeInfo] = useState<{
  fee_payer: string;
  processing_fee?: number;
  total_amount?: number;
} | null>(null)
const [taxInfo, setTaxInfo] = useState<{
  tax_enabled: boolean;
  tax_rate: number;
  tax_acronym: string;
  tax_amount: number;
  country_code: string;
  country_name: string;
  subtotal: number;
  total: number;
  currency: string;
} | null>(null)
const [redirectUrl, setRedirectUrl] = useState<string | null>(null)
const [isExpired, setIsExpired] = useState<boolean>(false)
```

#### 1.2 Update getQueryData Function

Replace the current `getQueryData` function with:

```typescript
const getQueryData = async () => {
  try {
    const query_data = router.query.d
    const {
      data: { data }
    }: { data: any } = await axiosBaseApi.post('pay/getData', {
      data: query_data
    })
    
    // Existing: Basic payment data
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
    setLinkId(tempToken?.transaction_id || data.transaction_id || '')

    // NEW: Capture enhanced checkout data
    setDescription(data.description || null)
    setOrderReference(data.order_reference || null)
    setMerchantInfo(data.merchant || null)
    setFeeInfo(data.fee_info || null)
    setRedirectUrl(data.redirect_url || null)
    
    // NEW: Handle expiry
    if (data.expiry) {
      setExpiryInfo(data.expiry)
      if (data.expiry.is_expired) {
        setIsExpired(true)
        dispatch({
          type: TOAST_SHOW,
          payload: {
            message: t('checkout.linkExpiredMessage'),
            severity: 'error'
          }
        })
      }
    }
    
    // NEW: Handle tax info
    if (data.apply_tax && data.tax_info) {
      setTaxInfo(data.tax_info)
      // Update wallet amount to include tax if applicable
      if (data.tax_info.total) {
        setWalletState(prev => ({
          ...prev,
          amount: data.tax_info.total
        }))
      }
    }

    // Existing: Currency rates
    const amount = data.tax_info?.total || Number(data.amount)
    if (amount && data.base_currency) {
      try {
        const ratesResponse = await axiosBaseApi.post('/pay/getCurrencyRates', {
          source: data.base_currency,
          amount: amount,
          currencyList: [data.base_currency],
          fixedDecimal: false,
          fee_payer: data.fee_payer || undefined
        });
        if (ratesResponse?.data?.data && ratesResponse.data.data[0]) {
          setCurrencyRates(ratesResponse.data.data[0]);
        }
      } catch (rateError: any) {
        console.log('Failed to fetch initial rates:', rateError?.message);
      }
    }

    setLoading(false)
  } catch (e: any) {
    setLoading(false)
    const message = e?.response?.data?.message ?? e.message
    dispatch({
      type: TOAST_SHOW,
      payload: {
        message: message,
        severity: 'error'
      }
    })
  }
}
```

#### 1.3 Update the UI - Replace Paper Content

Replace the entire `<Paper>` component content with the enhanced version below. This maintains the current UI feel while adding new sections:

```tsx
<Paper
  elevation={3}
  sx={{
    borderRadius: 4,
    p: 4,
    width: '100%',
    maxWidth: 500,
    marginTop: 10,
    textAlign: 'center',
    margin: 0,
    border: `1px solid ${isDark ? theme.palette.surface.border : '#E7EAFD'}`,
    boxShadow: isDark
      ? '0px 45px 64px 0px rgba(0,0,0,0.3)'
      : '0px 45px 64px 0px #0D03230F',
    backgroundColor: theme.palette.background.paper,
    transition: 'all 0.3s ease',
  }}
>
  {/* MERCHANT BRANDING */}
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

  {/* DYNAMIC TITLE - Context-aware messaging */}
  <Typography
    fontWeight={500}
    fontSize={25}
    lineHeight='98%'
    gutterBottom
    fontFamily='Space Grotesk'
    color={theme.palette.text.primary}
  >
    {description 
      ? t('checkout.titleWithOrder')
      : merchantInfo?.company_name 
        ? t('checkout.titleWithMerchant')
        : t('checkout.titleGeneric')
    }
  </Typography>

  {/* DYNAMIC SUBTITLE */}
  <Typography
    color={isDark ? theme.palette.text.secondary : '#6B7280'}
    fontWeight={400}
    fontSize={14}
    lineHeight='18px'
    mb={2}
    fontFamily='Space Grotesk'
  >
    {merchantInfo?.company_name 
      ? t('checkout.subtitleWithMerchant', { merchant: merchantInfo.company_name })
      : t('checkout.subtitleGeneric')
    }
  </Typography>

  {/* ORDER SUMMARY SECTION - NEW */}
  {(description || orderReference) && (
    <Box
      sx={{
        backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : '#F9FAFB',
        borderRadius: '10px',
        p: 2,
        mb: 2,
        textAlign: 'left',
        border: `1px solid ${isDark ? theme.palette.surface.border : '#E5E7EB'}`
      }}
    >
      {/* Purchase Description */}
      {description && (
        <Box mb={orderReference ? 1.5 : 0}>
          <Typography
            variant='caption'
            color={isDark ? theme.palette.text.secondary : '#6B7280'}
            fontWeight={600}
            fontSize={10}
            textTransform='uppercase'
            letterSpacing={0.8}
            fontFamily='Space Grotesk'
          >
            {t('checkout.orderDescription')}
          </Typography>
          <Typography
            color={theme.palette.text.primary}
            fontWeight={500}
            fontSize={14}
            fontFamily='Space Grotesk'
            mt={0.5}
            sx={{ wordBreak: 'break-word' }}
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
              fontWeight={600}
              fontSize={10}
              textTransform='uppercase'
              letterSpacing={0.8}
              fontFamily='Space Grotesk'
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
                p: 0.8,
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

  {/* PAYMENT BREAKDOWN SECTION */}
  <Box
    alignItems='center'
    border={`1px solid ${isDark ? theme.palette.surface.border : '#DFDFDF'}`}
    borderRadius={'10px'}
    px='21px'
    py='18px'
    sx={{ transition: 'border-color 0.3s ease' }}
  >
    {/* Amount Breakdown - NEW */}
    <Box mb={2}>
      {/* Subtotal (Base Amount) */}
      <Box display='flex' justifyContent='space-between' alignItems='center' mb={1}>
        <Typography
          variant='body2'
          color={isDark ? theme.palette.text.secondary : '#6B7280'}
          fontFamily='Space Grotesk'
          fontSize={13}
        >
          {t('checkout.subtotal')}
        </Typography>
        <Typography
          fontWeight={500}
          fontFamily='Space Grotesk'
          fontSize={14}
          color={theme.palette.text.primary}
        >
          {taxInfo ? taxInfo.subtotal.toFixed(2) : walletState?.amount?.toFixed(2)} {walletState?.currency}
        </Typography>
      </Box>

      {/* Processing Fee (if customer pays) */}
      {feeInfo?.fee_payer === 'customer' && feeInfo?.processing_fee && feeInfo.processing_fee > 0 && (
        <Box display='flex' justifyContent='space-between' alignItems='center' mb={1}>
          <Box display='flex' alignItems='center' gap={0.5}>
            <Typography
              variant='body2'
              color={isDark ? theme.palette.text.secondary : '#6B7280'}
              fontFamily='Space Grotesk'
              fontSize={13}
            >
              {t('checkout.processingFee')}
            </Typography>
            <Tooltip title={t('checkout.processingFeeTooltip')}>
              <Icon 
                icon='mdi:information-outline' 
                width={14} 
                color={isDark ? theme.palette.text.secondary : '#9CA3AF'} 
              />
            </Tooltip>
          </Box>
          <Typography
            fontWeight={500}
            fontFamily='Space Grotesk'
            fontSize={14}
            color={theme.palette.text.primary}
          >
            {feeInfo.processing_fee.toFixed(2)} {walletState?.currency}
          </Typography>
        </Box>
      )}

      {/* Sales Tax (if enabled) */}
      {taxInfo?.tax_enabled && taxInfo.tax_amount > 0 && (
        <Box display='flex' justifyContent='space-between' alignItems='center' mb={1}>
          <Typography
            variant='body2'
            color={isDark ? theme.palette.text.secondary : '#6B7280'}
            fontFamily='Space Grotesk'
            fontSize={13}
          >
            {taxInfo.tax_acronym} ({taxInfo.tax_rate}% - {taxInfo.country_name})
          </Typography>
          <Typography
            fontWeight={500}
            fontFamily='Space Grotesk'
            fontSize={14}
            color={theme.palette.text.primary}
          >
            {taxInfo.tax_amount.toFixed(2)} {walletState?.currency}
          </Typography>
        </Box>
      )}

      {/* Fee Payer Indicator (subtle) */}
      {feeInfo?.fee_payer === 'company' && (
        <Box display='flex' alignItems='center' gap={0.5} mb={1}>
          <Icon icon='mdi:check-circle' width={14} color='#12B76A' />
          <Typography
            variant='caption'
            color='#12B76A'
            fontFamily='Space Grotesk'
            fontSize={11}
          >
            {t('checkout.feesIncluded')}
          </Typography>
        </Box>
      )}
    </Box>

    <Divider sx={{ mb: 2, borderColor: isDark ? theme.palette.surface.border : undefined }} />

    {/* TOTAL TO PAY */}
    <Box
      display='flex'
      justifyContent='space-between'
      alignItems='center'
      mb={2}
    >
      <Typography
        variant='subtitle2'
        fontFamily='Space Grotesk'
        fontWeight={600}
        fontSize={16}
        color={theme.palette.text.primary}
      >
        {t('checkout.totalToPay')}
      </Typography>

      {/* Currency Selector with Total Amount */}
      <Box
        display='flex'
        alignItems='center'
        border={1}
        borderRadius='6px'
        padding={1}
        gap={1}
        sx={{
          cursor: 'pointer',
          borderColor: isOpen ? (isDark ? '#6C7BFF' : '#737373') : 'transparent',
          '&:hover': {
            border: `1px solid ${isDark ? '#4a4a6a' : '#D9D9D9'}`
          }
        }}
        onClick={handleClick}
      >
        {!loading ? (
          <>
            {currencyOptions?.find(c => c.code === currencyRates?.currency)?.icon ||
              currencyOptions.find(c => c.code === walletState?.currency)?.icon}
            <Typography
              fontWeight={600}
              fontFamily='Space Grotesk'
              fontSize={20}
              color={theme.palette.text.primary}
              sx={{ fontSize: { xs: '14px', sm: '18px', md: '20px' } }}
            >
              {/* Calculate total: base + tax + fees (if customer pays) */}
              {(() => {
                let total = taxInfo?.total || Number(walletState?.amount || 0);
                if (feeInfo?.fee_payer === 'customer' && feeInfo?.processing_fee) {
                  total += feeInfo.processing_fee;
                }
                return total.toFixed(2);
              })()}{' '}
              {currencyRates?.currency ?? walletState?.currency}
            </Typography>
            <Icon
              icon={isOpen ? 'solar:alt-arrow-up-linear' : 'solar:alt-arrow-down-linear'}
              width='17'
              height='17'
              color={theme.palette.text.primary}
            />
          </>
        ) : (
          <Skeleton variant='rectangular' width={154} height={24} animation='wave'
            sx={{ borderRadius: '6px', background: isDark ? '#2a2a4a' : '#F5F8FF' }}
          />
        )}
        
        {/* Currency Menu - keep existing */}
        <Menu anchorEl={anchorEl} open={isOpen} onClose={handleClose}
          PaperProps={{
            sx: {
              border: `1px solid ${isDark ? '#4a4a6a' : '#737373'}`,
              borderRadius: '10px',
              marginTop: '10px',
              py: '4px',
              px: '10px',
              backgroundColor: theme.palette.background.paper,
            }
          }}
        >
          {currencyOptions.map(currency => (
            <MenuItem
              key={currency.code}
              onClick={e => handleSelect(e, currency.code)}
              sx={{
                px: { xs: 1.5, sm: 2, md: 2.5 },
                py: { xs: 1, sm: 1.2, md: 1.5 },
                borderRadius: '6px',
                '&:hover': { backgroundColor: isDark ? '#2a2a4a' : '#F5F8FF' }
              }}
            >
              <Box display='flex' alignItems='center' gap={1}>
                {currency.icon}
                <Typography color={theme.palette.text.primary}
                  sx={{ fontSize: { xs: '14px', sm: '18px', md: '14px' }, fontWeight: '500' }}
                >
                  {t(currency.labelKey)}
                </Typography>
              </Box>
            </MenuItem>
          ))}
        </Menu>
      </Box>
    </Box>

    {/* PAYMENT METHOD BUTTONS */}
    <Box display='flex' gap={2}>
      <Button
        fullWidth
        variant='outlined'
        disabled={isExpired}
        startIcon={<Icon icon='mingcute:bank-line' width='16' />}
        onClick={() => { setActiveStep(1); setTransferMethod('bank'); }}
        sx={{
          borderColor: '#444CE7',
          color: '#444CE7',
          textTransform: 'none',
          fontFamily: 'Space Grotesk',
          fontWeight: '500',
          borderRadius: 30,
          py: { xs: 1.2 },
          fontSize: '14px',
          minHeight: 48,
          '&:hover': {
            backgroundColor: isDark ? 'rgba(68, 76, 231, 0.1)' : '#EEF2FF',
            borderColor: '#444CE7'
          },
          '&:disabled': {
            borderColor: isDark ? '#4a4a6a' : '#D1D5DB',
            color: isDark ? '#6B7280' : '#9CA3AF'
          }
        }}
      >
        {isSmallScreen ? t('checkout.bank') : t('checkout.bankTransfer')}
      </Button>

      <Button
        fullWidth
        variant='outlined'
        disabled={isExpired}
        startIcon={<BitCoinGreenIcon width={8.25} />}
        onClick={() => { setActiveStep(1); setTransferMethod('crypto'); }}
        sx={{
          borderColor: '#12B76A',
          color: '#12B76A',
          textTransform: 'none',
          borderRadius: 30,
          fontFamily: 'Space Grotesk',
          py: { xs: 1.2 },
          fontSize: '14px',
          minHeight: 48,
          '&:hover': {
            backgroundColor: isDark ? 'rgba(18, 183, 106, 0.1)' : '#ECFDF5',
            borderColor: '#12B76A'
          },
          '&:disabled': {
            borderColor: isDark ? '#4a4a6a' : '#D1D5DB',
            color: isDark ? '#6B7280' : '#9CA3AF'
          }
        }}
      >
        {isSmallScreen ? t('checkout.crypto') : t('checkout.cryptocurrency')}
      </Button>
    </Box>
  </Box>

  {/* EXPIRY WARNING - NEW */}
  {expiryInfo && !expiryInfo.is_expired && expiryInfo.countdown && (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 1,
        mt: 2,
        p: 1.5,
        backgroundColor: isDark ? 'rgba(251, 188, 5, 0.08)' : '#FFFBEB',
        borderRadius: '8px',
        border: `1px solid ${isDark ? 'rgba(251, 188, 5, 0.2)' : '#FDE68A'}`
      }}
    >
      <Icon icon='mdi:clock-outline' width={16} color='#F59E0B' />
      <Typography
        variant='caption'
        fontFamily='Space Grotesk'
        fontWeight={500}
        fontSize={12}
        color={isDark ? '#FCD34D' : '#B45309'}
      >
        {t('checkout.expiresIn', { time: expiryInfo.countdown.formatted })}
      </Typography>
    </Box>
  )}

  {/* LINK EXPIRED STATE - NEW */}
  {isExpired && (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 1,
        mt: 2,
        p: 1.5,
        backgroundColor: isDark ? 'rgba(239, 68, 68, 0.08)' : '#FEF2F2',
        borderRadius: '8px',
        border: `1px solid ${isDark ? 'rgba(239, 68, 68, 0.2)' : '#FECACA'}`
      }}
    >
      <Icon icon='mdi:clock-alert-outline' width={16} color='#EF4444' />
      <Typography
        variant='caption'
        fontFamily='Space Grotesk'
        fontWeight={500}
        fontSize={12}
        color={isDark ? '#FCA5A5' : '#B91C1C'}
      >
        {t('checkout.linkExpiredMessage')}
      </Typography>
    </Box>
  )}

  {/* TRANSACTION ID FOOTER - Keep existing but styled */}
  <Box display='flex' justifyContent='space-between' alignItems='center' mt={3}>
    <Typography
      variant='caption'
      color={isDark ? theme.palette.text.secondary : '#6B7280'}
      fontWeight={400}
      fontSize={11}
      sx={{ textAlign: 'left' }}
      fontFamily='Space Grotesk'
    >
      {t('checkout.transactionIdNote')}
    </Typography>

    <Box display='flex' alignItems='center' gap={1}>
      <Typography
        variant='caption'
        fontWeight={500}
        fontSize={11}
        color={isDark ? theme.palette.text.secondary : '#6B7280'}
        fontFamily='Space Grotesk'
      >
        #{linkId || t('checkout.loading')}
      </Typography>
      <Tooltip title={t('common.copy')}>
        <IconButton
          size='small'
          onClick={() => {
            navigator.clipboard.writeText(linkId)
            dispatch({
              type: TOAST_SHOW,
              payload: { message: t('common.copied'), severity: 'success' }
            })
          }}
          sx={{
            bgcolor: isDark ? '#2a2a4a' : '#E7EAFD',
            p: 0.5,
            height: '22px',
            width: '22px',
            borderRadius: '5px',
            '&:hover': { bgcolor: isDark ? '#3a3a5a' : '#E0E7FF' }
          }}
        >
          <CopyIcon />
        </IconButton>
      </Tooltip>
    </Box>
  </Box>

  {/* SECURE PAYMENT BADGE - NEW */}
  <Box display='flex' alignItems='center' justifyContent='center' gap={0.5} mt={2}>
    <Icon icon='mdi:lock' width={12} color={isDark ? '#6B7280' : '#9CA3AF'} />
    <Typography
      variant='caption'
      color={isDark ? '#6B7280' : '#9CA3AF'}
      fontSize={10}
      fontFamily='Space Grotesk'
    >
      {t('checkout.securePayment')}
    </Typography>
  </Box>
</Paper>
```

---

### 2. Translation File Updates

#### `public/locales/en/common.json`

Replace the entire file with:

```json
{
  "header": {
    "wallet": "Dynopay Wallet",
    "language": "EN"
  },
  "checkout": {
    "titleGeneric": "Complete Your Payment",
    "titleWithOrder": "Review Your Order",
    "titleWithMerchant": "Checkout",
    "subtitleGeneric": "Select your preferred payment method to continue",
    "subtitleWithMerchant": "Complete your payment to {{merchant}}",
    "orderDescription": "Order Details",
    "invoiceNumber": "Invoice / Reference",
    "subtotal": "Subtotal",
    "processingFee": "Processing Fee",
    "processingFeeTooltip": "This fee covers payment processing costs",
    "feesIncluded": "Processing fees included",
    "totalToPay": "Total",
    "toPay": "Amount",
    "bankTransfer": "Bank Transfer",
    "bank": "Bank",
    "cryptocurrency": "Cryptocurrency",
    "crypto": "Crypto",
    "transactionIdNote": "Reference ID:",
    "loading": "Loading...",
    "expiresIn": "Payment link expires in {{time}}",
    "linkExpired": "Payment link expired",
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
    "copied": "Copied!",
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
    "titleWithOrder": "Reveja o Seu Pedido",
    "titleWithMerchant": "Checkout",
    "subtitleGeneric": "Selecione o método de pagamento preferido para continuar",
    "subtitleWithMerchant": "Complete o pagamento para {{merchant}}",
    "orderDescription": "Detalhes do Pedido",
    "invoiceNumber": "Fatura / Referência",
    "subtotal": "Subtotal",
    "processingFee": "Taxa de Processamento",
    "processingFeeTooltip": "Esta taxa cobre os custos de processamento do pagamento",
    "feesIncluded": "Taxas de processamento incluídas",
    "totalToPay": "Total",
    "toPay": "Valor",
    "bankTransfer": "Transferência Bancária",
    "bank": "Banco",
    "cryptocurrency": "Criptomoeda",
    "crypto": "Cripto",
    "transactionIdNote": "ID de Referência:",
    "loading": "A carregar...",
    "expiresIn": "Link de pagamento expira em {{time}}",
    "linkExpired": "Link de pagamento expirado",
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

### 3. Pass Data to Child Components

Update the component calls to pass new props:

```tsx
// For CryptoTransfer
<CryptoTransfer
  activeStep={activeStep}
  setActiveStep={setActiveStep}
  walletState={walletState}
  feePayer={feePayer}
  redirectUrl={redirectUrl}
  taxInfo={taxInfo}
/>

// For BankTransferCompo
<BankTransferCompo
  activeStep={activeStep}
  setActiveStep={setActiveStep}
  walletState={walletState}
  setIsSuccess={setIsSuccess}
  setIsBank={setIsBank}
  redirectUrl={redirectUrl}
  taxInfo={taxInfo}
/>

// For TransferExpectedCard
<TransferExpectedCard
  isTrue={isSuccess}
  dataUrl={redirectUrl || isBank || ''}
  type={transferMethod === 'crypto' ? 'crypto' : 'bank'}
/>
```

---

## Visual Reference - Before vs After

### BEFORE (Current)
```
┌─────────────────────────────────────────┐
│              [DynoPay Logo]              │
│                                          │
│    Your order is almost complete!        │
│  Choose a payment method below to        │
│      finalize your transaction:          │
│                                          │
│  ┌────────────────────────────────────┐  │
│  │ To Pay:            €50.00 EUR ▼   │  │
│  ├────────────────────────────────────┤  │
│  │  [Bank Transfer]  [Cryptocurrency] │  │
│  └────────────────────────────────────┘  │
│                                          │
│  If you need to continue later...        │
│  #abc123...                    [Copy]    │
└─────────────────────────────────────────┘
```

### AFTER (Enhanced)
```
┌─────────────────────────────────────────┐
│           [Merchant Logo]                │
│                                          │
│         Review Your Order                │
│   Complete your payment to Acme Store    │
│                                          │
│  ┌────────────────────────────────────┐  │
│  │ ORDER DETAILS                      │  │
│  │ Monthly Pro Subscription           │  │
│  │                                    │  │
│  │ INVOICE / REFERENCE                │  │
│  │ INV-2026-A1B2C3            [Copy]  │  │
│  └────────────────────────────────────┘  │
│                                          │
│  ┌────────────────────────────────────┐  │
│  │ Subtotal                  €100.00  │  │
│  │ Processing Fee              €4.00  │  │
│  │ VAT (23% - Portugal)       €23.00  │  │
│  │ ✓ Processing fees included         │  │
│  ├────────────────────────────────────┤  │
│  │ Total               €127.00 EUR ▼  │  │
│  ├────────────────────────────────────┤  │
│  │  [Bank Transfer]  [Cryptocurrency] │  │
│  └────────────────────────────────────┘  │
│                                          │
│   ⏰ Payment link expires in 6d:23h:45m  │
│                                          │
│  Reference ID: #abc123...        [Copy]  │
│         🔒 Secure payment by DynoPay     │
└─────────────────────────────────────────┘
```

---

## Summary of Changes

| Element | Old | New |
|---------|-----|-----|
| **Title** | "Your order is almost complete!" | Context-aware: "Review Your Order" / "Complete Your Payment" |
| **Subtitle** | "Choose a payment method..." | "Complete your payment to {merchant}" |
| **Logo** | Always DynoPay | Merchant logo if available |
| **Order Summary** | Not shown | Description + Invoice number box |
| **Amount Display** | Single "To Pay" value | Itemized breakdown |
| **Processing Fee** | Hidden | Shown if customer pays |
| **Tax** | Not shown | Shown if merchant enabled |
| **Expiry** | Not shown | Countdown warning |
| **Security Badge** | Not shown | "Secure payment" footer |

---

## Key Design Principles Maintained

1. **Dark/Light mode support** - All colors use theme variables
2. **Font consistency** - Space Grotesk throughout
3. **Border radius** - 10px for cards, 30px for buttons
4. **Color scheme** - Blue (#444CE7), Green (#12B76A), existing palette
5. **Responsive** - xs/sm/md breakpoints maintained
6. **Animations** - Smooth transitions preserved

This enhancement maintains the current premium feel while adding critical payment information for e-commerce and creator payments.
