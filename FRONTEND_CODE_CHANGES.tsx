// ============================================================
// FRONTEND CHECKOUT FIX - pages/pay/index.tsx
// Processing Fee Display - Pending Crypto Selection
// ============================================================

// ===========================================
// CHANGE 1: Add feeInfo state (around line 90)
// ===========================================
// After these existing lines:
//   const [feePayer, setFeePayer] = useState<string>('')
//   const [linkId, setLinkId] = useState<string>('')

// ADD this new state:
const [feeInfo, setFeeInfo] = useState<{
  estimated_processing_fee?: number;
  fees_pending_crypto_selection?: boolean;
  subtotal?: number;
  tax_amount?: number;
  total_amount?: number;
} | null>(null)


// ===========================================
// CHANGE 2: Store fee_info in getQueryData (around line 127)
// ===========================================
// After this existing line:
//   setFeePayer(data.fee_payer || '')

// ADD this:
if (data.fee_info) {
  setFeeInfo(data.fee_info)
}


// ===========================================
// CHANGE 3: Update amount display (around line 280-295)
// ===========================================
// REPLACE the amount display Typography with this:

{!loading ? (
  <>
    {currencyOptions?.find(
      c => c.code === currencyRates?.currency
    )?.icon ||
      currencyOptions.find(
        c => c.code === walletState?.currency
      )?.icon}

    <Box>
      <Typography
        fontWeight={500}
        fontFamily='Space Grotesk'
        fontSize={25}
        color={theme.palette.text.primary}
        sx={{
          fontSize: {
            xs: '12px',
            sm: '18px',
            md: '20px'
          }
        }}
      >
        {(() => {
          // If customer pays fees and crypto not selected yet, show subtotal + tax only
          if (feePayer === 'customer' && feeInfo?.fees_pending_crypto_selection) {
            const subtotal = feeInfo?.subtotal || walletState?.amount || 0
            const tax = feeInfo?.tax_amount || 0
            return (subtotal + tax).toFixed(2)
          }
          // Otherwise show the full amount from rates or wallet state
          return Number(
            currencyRates?.total_amount_source ?? currencyRates?.amount ?? walletState?.amount
          ).toFixed(2)
        })()}{' '}
        {currencyRates?.currency ?? walletState?.currency}
      </Typography>
      
      {/* Processing fee hint when customer pays fees but crypto not selected */}
      {feePayer === 'customer' && feeInfo?.fees_pending_crypto_selection && feeInfo?.estimated_processing_fee && (
        <Typography
          variant="caption"
          color={isDark ? theme.palette.text.secondary : '#666'}
          fontFamily='Space Grotesk'
          fontSize={10}
          sx={{ 
            display: 'block',
            textAlign: 'right',
            opacity: 0.8
          }}
        >
          + {walletState?.currency === 'EUR' ? '€' : '$'}{feeInfo.estimated_processing_fee.toFixed(2)} fee (varies)
        </Typography>
      )}
    </Box>
    
    <Icon
      icon={
        isOpen
          ? 'solar:alt-arrow-up-linear'
          : 'solar:alt-arrow-down-linear'
      }
      width='17'
      height='17'
      color={theme.palette.text.primary}
    />
  </>
) : (
  <Skeleton
    variant='rectangular'
    width={154}
    height={24}
    animation='wave'
    sx={{
      borderRadius: '6px',
      background: isDark ? '#2a2a4a' : '#F5F8FF'
    }}
  />
)}


// ===========================================
// CHANGE 4 (OPTIONAL): Don't pass fee_payer in initial rates fetch
// ===========================================
// In getQueryData function, around line 133-146
// This prevents pre-calculating fees before crypto selection

// BEFORE:
const ratesResponse = await axiosBaseApi.post('/pay/getCurrencyRates', {
  source: data.base_currency,
  amount: amount,
  currencyList: [data.base_currency],
  fixedDecimal: false,
  fee_payer: data.fee_payer || undefined  // REMOVE THIS LINE
});

// AFTER:
const ratesResponse = await axiosBaseApi.post('/pay/getCurrencyRates', {
  source: data.base_currency,
  amount: amount,
  currencyList: [data.base_currency],
  fixedDecimal: false
  // fee_payer removed - accurate fees calculated in CryptoTransfer
});
