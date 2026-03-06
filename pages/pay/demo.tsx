import {
  Box,
  Button,
  Divider,
  IconButton,
  Paper,
  Tooltip,
  Typography,
  useTheme,
  Snackbar
} from '@mui/material'
import React, { useEffect, useState, useCallback } from 'react'
import { Icon } from '@iconify/react'
import BitCoinGreenIcon from '@/assets/Icons/BitCoinGreenIcon'
import Logo from '@/assets/Icons/Logo'
import Pay3Layout from '@/Components/Layout/Pay3Layout'
import CopyIcon from '@/assets/Icons/CopyIcon'
import { useTranslation } from 'react-i18next'
import ProgressBar from '@/Components/UI/ProgressBar'

// Mock data for demo
const MOCK_DATA = {
  description: 'Monthly Pro Subscription',
  orderReference: 'INV-2026-A1B2C3',
  customerName: 'John Doe',
  merchantInfo: {
    name: 'Acme Store',
    company_logo: null
  },
  feeInfo: {
    processing_fee: 2.50,
    fee_payer: 'merchant' as const
  },
  taxInfo: {
    rate: 23,
    amount: 23.00,
    country: 'Portugal',
    type: 'VAT'
  },
  expiryInfo: {
    expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
  },
  walletState: {
    amount: 100.00,
    currency: 'EUR'
  },
  totalAmount: 125.50
}

const PaymentDemo = () => {
  const theme = useTheme()
  const isDark = theme.palette.mode === 'dark'
  const { t } = useTranslation('common')
  const [copySnackbar, setCopySnackbar] = useState(false)
  const [countdown, setCountdown] = useState('')

  useEffect(() => {
    const updateCountdown = () => {
      const now = new Date().getTime()
      const expiry = new Date(MOCK_DATA.expiryInfo.expires_at).getTime()
      const diff = expiry - now
      if (diff <= 0) { setCountdown('Expired'); return }
      const days = Math.floor(diff / (1000 * 60 * 60 * 24))
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
      const seconds = Math.floor((diff % (1000 * 60)) / 1000)
      const parts = []
      if (days > 0) parts.push(`${days}${t('checkout.days')}`)
      if (hours > 0 || days > 0) parts.push(`${hours}${t('checkout.hours')}`)
      if (minutes > 0 || hours > 0 || days > 0) parts.push(`${minutes}${t('checkout.minutes')}`)
      parts.push(`${seconds}${t('checkout.seconds')}`)
      setCountdown(parts.join(':'))
    }
    updateCountdown()
    const interval = setInterval(updateCountdown, 1000)
    return () => clearInterval(interval)
  }, [t])

  const handleCopyInvoice = useCallback(async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(MOCK_DATA.orderReference)
      } else {
        const ta = document.createElement('textarea')
        ta.value = MOCK_DATA.orderReference
        ta.style.position = 'fixed'
        ta.style.left = '-9999px'
        document.body.appendChild(ta)
        ta.select()
        document.execCommand('copy')
        document.body.removeChild(ta)
      }
      setCopySnackbar(true)
    } catch {
      setCopySnackbar(true)
    }
  }, [])

  return (
    <Pay3Layout>
      <Box>
        <ProgressBar activeStep={0} />

        <Box
          display='flex'
          alignItems='flex-start'
          justifyContent='center'
          px={{ xs: 1.5, sm: 2 }}
          py={{ xs: 1, sm: 2 }}
        >
          <Paper
            elevation={0}
            data-testid="checkout-card"
            sx={{
              borderRadius: 3,
              p: { xs: 2, sm: 2.5 },
              width: '100%',
              maxWidth: 440,
              textAlign: 'center',
              border: `1px solid ${isDark ? theme.palette.surface?.border || '#2a2a4a' : '#E9ECF2'}`,
              boxShadow: isDark
                ? '0 8px 32px rgba(0,0,0,0.3)'
                : '0 4px 24px rgba(0,0,0,0.06)',
              backgroundColor: theme.palette.background.paper,
              transition: 'all 0.3s ease',
            }}
          >
            {/* Logo */}
            <Box display='flex' justifyContent='center' mb={1}>
              {MOCK_DATA.merchantInfo.company_logo ? (
                <Box
                  component="img"
                  src={MOCK_DATA.merchantInfo.company_logo}
                  alt={MOCK_DATA.merchantInfo.name}
                  sx={{ maxHeight: 36, maxWidth: 120, objectFit: 'contain' }}
                />
              ) : (
                <Logo width={36} height={42} />
              )}
            </Box>

            {/* Title */}
            <Typography
              fontWeight={700}
              fontSize={{ xs: 18, sm: 20 }}
              lineHeight={1.2}
              color={theme.palette.text.primary}
              data-testid="checkout-title"
            >
              {t('checkout.title')}
            </Typography>

            {/* Subtitle */}
            <Typography
              color={theme.palette.text.secondary}
              fontWeight={400}
              fontSize={13}
              lineHeight={1.4}
              mb={2}
              mt={0.5}
              data-testid="checkout-subtitle"
            >
              {MOCK_DATA.customerName
                ? `Hi ${MOCK_DATA.customerName}, complete your payment to ${MOCK_DATA.merchantInfo.name}`
                : t('checkout.subtitle', { merchant: MOCK_DATA.merchantInfo.name })
              }
            </Typography>

            {/* Order Details */}
            <Box
              sx={{
                border: `1px solid ${isDark ? theme.palette.surface?.border || '#2a2a4a' : '#E9ECF2'}`,
                borderRadius: '10px',
                p: 1.5,
                mb: 1.5,
                textAlign: 'left',
                backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : '#FAFBFF'
              }}
              data-testid="order-details-section"
            >
              <Typography
                fontWeight={700}
                fontSize={10}
                color={theme.palette.text.secondary}
                letterSpacing={0.8}
                textTransform='uppercase'
                mb={0.5}
              >
                {t('checkout.orderDetails')}
              </Typography>

              <Typography fontWeight={600} fontSize={13} color={theme.palette.text.primary} mb={0.75}>
                {MOCK_DATA.description}
              </Typography>

              {MOCK_DATA.customerName && (
                <Box display='flex' alignItems='center' gap={0.5} mb={0.75}>
                  <Icon icon="mdi:account-outline" width={14} color={theme.palette.text.secondary} />
                  <Typography fontWeight={500} fontSize={12} color={theme.palette.text.primary} data-testid="customer-name">
                    {MOCK_DATA.customerName}
                  </Typography>
                </Box>
              )}

              <Box display='flex' alignItems='center' justifyContent='space-between'>
                <Box>
                  <Typography fontWeight={700} fontSize={9} color={theme.palette.text.secondary} letterSpacing={0.5} textTransform='uppercase'>
                    {t('checkout.invoice')}
                  </Typography>
                  <Typography fontWeight={500} fontSize={12} color={theme.palette.text.primary} data-testid="invoice-number">
                    {MOCK_DATA.orderReference}
                  </Typography>
                </Box>
                <Tooltip title={t('checkout.copyInvoice')}>
                  <IconButton
                    size='small'
                    onClick={handleCopyInvoice}
                    data-testid="copy-invoice-btn"
                    sx={{
                      bgcolor: isDark ? '#2a2a4a' : '#E9ECF2',
                      p: 0.5,
                      borderRadius: '6px',
                      '&:hover': { bgcolor: isDark ? '#3a3a5a' : '#dde1e8' }
                    }}
                  >
                    <CopyIcon />
                  </IconButton>
                </Tooltip>
              </Box>
            </Box>

            {/* Fee Breakdown */}
            <Box
              border={`1px solid ${isDark ? theme.palette.surface?.border || '#2a2a4a' : '#E9ECF2'}`}
              borderRadius='10px'
              px={1.5}
              py={1.5}
              data-testid="fee-breakdown-section"
            >
              {/* Subtotal */}
              <Box display='flex' justifyContent='space-between' alignItems='center' mb={0.5}>
                <Typography fontSize={13} color={theme.palette.text.secondary}>
                  {t('checkout.subtotal')}
                </Typography>
                <Typography fontSize={13} fontWeight={600} color={theme.palette.text.primary}>
                  €{MOCK_DATA.walletState.amount.toFixed(2)}
                </Typography>
              </Box>

              {/* Tax */}
              <Box display='flex' justifyContent='space-between' alignItems='center' mb={0.5}>
                <Typography fontSize={13} color={theme.palette.text.secondary}>
                  {t('checkout.vatRate', { rate: MOCK_DATA.taxInfo.rate, country: MOCK_DATA.taxInfo.country })}
                </Typography>
                <Typography fontSize={13} fontWeight={600} color={theme.palette.text.primary}>
                  €{MOCK_DATA.taxInfo.amount.toFixed(2)}
                </Typography>
              </Box>

              {/* Processing Fee */}
              <Box display='flex' justifyContent='space-between' alignItems='center' mb={0.25}>
                <Box display='flex' alignItems='center' gap={0.5}>
                  <Typography fontSize={13} color={theme.palette.text.secondary}>
                    {t('checkout.processingFee')}
                  </Typography>
                  {MOCK_DATA.feeInfo.fee_payer === 'merchant' && (
                    <Icon icon="mdi:check-circle" color="#12B76A" width={13} />
                  )}
                </Box>
                <Typography fontSize={13} fontWeight={600} color={theme.palette.text.primary}>
                  €{MOCK_DATA.feeInfo.processing_fee.toFixed(2)}
                </Typography>
              </Box>

              <Typography fontSize={11} color="#12B76A" mb={0.5}>
                {t('checkout.processingFeesIncluded')}
              </Typography>

              <Divider sx={{ my: 1, borderColor: isDark ? theme.palette.surface?.border : undefined }} />

              {/* Total */}
              <Box display='flex' justifyContent='space-between' alignItems='center' mb={1.5}>
                <Typography fontWeight={700} fontSize={{ xs: 14, sm: 15 }} color={theme.palette.text.primary}>
                  {t('checkout.total')}
                </Typography>
                <Box display='flex' alignItems='center' gap={0.5}>
                  <Typography fontWeight={700} fontSize={{ xs: 16, sm: 18 }} color={theme.palette.text.primary} data-testid="total-amount">
                    €{MOCK_DATA.totalAmount.toFixed(2)} EUR
                  </Typography>
                  <Icon icon='solar:alt-arrow-down-linear' width='14' height='14' color={theme.palette.text.primary} />
                </Box>
              </Box>

              <Divider sx={{ mb: 1.5, borderColor: isDark ? theme.palette.surface?.border : undefined }} />

              {/* Pay Button */}
              <Button
                fullWidth
                variant='outlined'
                startIcon={<BitCoinGreenIcon width={7} />}
                data-testid="crypto-payment-btn"
                sx={{
                  borderColor: '#12B76A',
                  color: '#12B76A',
                  textTransform: 'none',
                  borderRadius: 30,
                  fontWeight: 600,
                  py: 1.25,
                  fontSize: '14px',
                  minHeight: 44,
                  '&:hover': {
                    backgroundColor: isDark ? 'rgba(18, 183, 106, 0.1)' : '#ECFDF5',
                    borderColor: '#12B76A'
                  }
                }}
              >
                {t('checkout.cryptocurrency')}
              </Button>
            </Box>

            {/* Expiry + Security row */}
            <Box
              display='flex'
              alignItems='center'
              justifyContent='space-between'
              mt={1.5}
              px={0.5}
            >
              <Box display='flex' alignItems='center' gap={0.5} data-testid="expiry-countdown">
                <Icon icon="mdi:clock-outline" width={13} color={theme.palette.text.secondary} />
                <Typography fontSize={11} color={theme.palette.text.secondary}>
                  {t('checkout.expiresIn')} <strong>{countdown}</strong>
                </Typography>
              </Box>
              <Box display='flex' alignItems='center' gap={0.5} data-testid="security-badge">
                <Icon icon="mdi:lock" width={12} color={isDark ? '#6C7BFF' : '#0004FF'} />
                <Typography fontSize={11} color={isDark ? '#6C7BFF' : '#0004FF'} fontWeight={600}>
                  {t('checkout.securePayment')}
                </Typography>
              </Box>
            </Box>
          </Paper>
        </Box>

        <Snackbar
          open={copySnackbar}
          autoHideDuration={2000}
          onClose={() => setCopySnackbar(false)}
          message={t('checkout.copied')}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        />
      </Box>
    </Pay3Layout>
  )
}

export default PaymentDemo
