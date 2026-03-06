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
import Image from 'next/image'
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
    company_logo: null // Set to null to show DynoPay logo, or use a URL
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
    expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days from now
  },
  walletState: {
    amount: 100.00,
    currency: 'EUR'
  },
  totalAmount: 125.50 // 100 + 23 tax + 2.50 fee
}

const PaymentDemo = () => {
  const theme = useTheme()
  const isDark = theme.palette.mode === 'dark'
  const { t } = useTranslation('common')
  
  const [copySnackbar, setCopySnackbar] = useState(false)
  const [countdown, setCountdown] = useState('')

  // Countdown timer effect
  useEffect(() => {
    const updateCountdown = () => {
      const now = new Date().getTime()
      const expiry = new Date(MOCK_DATA.expiryInfo.expires_at).getTime()
      const diff = expiry - now

      if (diff <= 0) {
        setCountdown('Expired')
        return
      }

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
      // Try modern clipboard API first
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(MOCK_DATA.orderReference)
      } else {
        // Fallback for environments without clipboard API
        const textArea = document.createElement('textarea')
        textArea.value = MOCK_DATA.orderReference
        textArea.style.position = 'fixed'
        textArea.style.left = '-999999px'
        textArea.style.top = '-999999px'
        document.body.appendChild(textArea)
        textArea.focus()
        textArea.select()
        document.execCommand('copy')
        document.body.removeChild(textArea)
      }
      setCopySnackbar(true)
    } catch (err) {
      // Fallback method
      const textArea = document.createElement('textarea')
      textArea.value = MOCK_DATA.orderReference
      textArea.style.position = 'fixed'
      textArea.style.left = '-999999px'
      textArea.style.top = '-999999px'
      document.body.appendChild(textArea)
      textArea.focus()
      textArea.select()
      document.execCommand('copy')
      document.body.removeChild(textArea)
      setCopySnackbar(true)
    }
  }, [])

  return (
    <Pay3Layout>
      <Box>
        <Box>
          <ProgressBar activeStep={0} />

          <Box
            display='flex'
            alignItems='center'
            justifyContent='center'
            px={2}
            minHeight={'calc(100vh - 340px)'}
          >
            <Paper
              elevation={3}
              data-testid="checkout-card"
              sx={{
                borderRadius: 4,
                p: { xs: 2.5, sm: 4 },
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
              {/* Logo Section */}
              <Box display='flex' justifyContent='center' mb={2}>
                {MOCK_DATA.merchantInfo.company_logo ? (
                  <Box
                    component="img"
                    src={MOCK_DATA.merchantInfo.company_logo}
                    alt={MOCK_DATA.merchantInfo.name}
                    sx={{ maxHeight: 50, maxWidth: 150, objectFit: 'contain' }}
                  />
                ) : (
                  <Logo />
                )}
              </Box>

              {/* Title */}
              <Typography
                fontWeight={500}
                fontSize={{ xs: 20, sm: 25 }}
                lineHeight='98%'
                gutterBottom
                fontFamily='Space Grotesk'
                color={theme.palette.text.primary}
                data-testid="checkout-title"
              >
                {t('checkout.title')}
              </Typography>

              {/* Subtitle with Merchant Name and Customer Personalization */}
              <Typography
                color={isDark ? theme.palette.text.secondary : '#000'}
                fontWeight={400}
                fontSize={14}
                lineHeight='18px'
                mb={3}
                fontFamily='Space Grotesk'
                data-testid="checkout-subtitle"
              >
                {MOCK_DATA.customerName 
                  ? `Hi ${MOCK_DATA.customerName}, complete your payment to ${MOCK_DATA.merchantInfo.name}`
                  : t('checkout.subtitle', { merchant: MOCK_DATA.merchantInfo.name })
                }
              </Typography>

              {/* Order Details Section */}
              <Box
                sx={{
                  border: `1px solid ${isDark ? theme.palette.surface.border : '#E7EAFD'}`,
                  borderRadius: '10px',
                  p: 2,
                  mb: 2,
                  textAlign: 'left',
                  backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : '#FAFBFF'
                }}
                data-testid="order-details-section"
              >
                <Typography
                  fontWeight={600}
                  fontSize={11}
                  color={isDark ? theme.palette.text.secondary : '#666'}
                  fontFamily='Space Grotesk'
                  letterSpacing={0.5}
                  mb={1}
                >
                  {t('checkout.orderDetails')}
                </Typography>
                
                <Typography
                  fontWeight={500}
                  fontSize={14}
                  color={theme.palette.text.primary}
                  fontFamily='Space Grotesk'
                  mb={1.5}
                >
                  {MOCK_DATA.description}
                </Typography>
                
                {MOCK_DATA.customerName && (
                  <Box display='flex' alignItems='center' gap={1} mb={1.5}>
                    <Icon icon="mdi:account-outline" width={16} color={isDark ? theme.palette.text.secondary : '#666'} />
                    <Typography
                      fontWeight={500}
                      fontSize={13}
                      color={theme.palette.text.primary}
                      fontFamily='Space Grotesk'
                      data-testid="customer-name"
                    >
                      {MOCK_DATA.customerName}
                    </Typography>
                  </Box>
                )}
                
                <Box display='flex' alignItems='center' justifyContent='space-between'>
                  <Box>
                    <Typography
                      fontWeight={600}
                      fontSize={10}
                      color={isDark ? theme.palette.text.secondary : '#888'}
                      fontFamily='Space Grotesk'
                      letterSpacing={0.5}
                    >
                      {t('checkout.invoice')}
                    </Typography>
                    <Typography
                      fontWeight={500}
                      fontSize={13}
                      color={theme.palette.text.primary}
                      fontFamily='Space Grotesk'
                      data-testid="invoice-number"
                    >
                      {MOCK_DATA.orderReference}
                    </Typography>
                  </Box>
                  <Tooltip title={t('checkout.copyInvoice')}>
                    <IconButton
                      size='small'
                      onClick={handleCopyInvoice}
                      data-testid="copy-invoice-btn"
                      sx={{
                        bgcolor: isDark ? '#2a2a4a' : '#E7EAFD',
                        p: 0.75,
                        borderRadius: '6px',
                        '&:hover': { bgcolor: isDark ? '#3a3a5a' : '#E0E7FF' }
                      }}
                    >
                      <CopyIcon />
                    </IconButton>
                  </Tooltip>
                </Box>
              </Box>

              {/* Fee Breakdown Section */}
              <Box
                border={`1px solid ${isDark ? theme.palette.surface.border : '#DFDFDF'}`}
                borderRadius={'10px'}
                px='21px'
                py='18px'
                data-testid="fee-breakdown-section"
              >
                {/* Subtotal Row */}
                <Box display='flex' justifyContent='space-between' alignItems='center' mb={1}>
                  <Typography
                    fontSize={14}
                    fontFamily='Space Grotesk'
                    color={isDark ? theme.palette.text.secondary : '#666'}
                  >
                    {t('checkout.subtotal')}
                  </Typography>
                  <Typography
                    fontSize={14}
                    fontFamily='Space Grotesk'
                    fontWeight={500}
                    color={theme.palette.text.primary}
                  >
                    €{MOCK_DATA.walletState.amount.toFixed(2)}
                  </Typography>
                </Box>

                {/* Tax Row */}
                <Box display='flex' justifyContent='space-between' alignItems='center' mb={1}>
                  <Typography
                    fontSize={14}
                    fontFamily='Space Grotesk'
                    color={isDark ? theme.palette.text.secondary : '#666'}
                  >
                    {t('checkout.vatRate', { rate: MOCK_DATA.taxInfo.rate, country: MOCK_DATA.taxInfo.country })}
                  </Typography>
                  <Typography
                    fontSize={14}
                    fontFamily='Space Grotesk'
                    fontWeight={500}
                    color={theme.palette.text.primary}
                  >
                    €{MOCK_DATA.taxInfo.amount.toFixed(2)}
                  </Typography>
                </Box>

                {/* Processing Fee Row - Always show with amount */}
                <Box display='flex' justifyContent='space-between' alignItems='center' mb={1}>
                  <Box display='flex' alignItems='center' gap={0.5}>
                    <Typography
                      fontSize={14}
                      fontFamily='Space Grotesk'
                      color={isDark ? theme.palette.text.secondary : '#666'}
                    >
                      {t('checkout.processingFee')}
                    </Typography>
                    {MOCK_DATA.feeInfo.fee_payer === 'merchant' && (
                      <Icon icon="mdi:check-circle" color="#12B76A" width={14} />
                    )}
                  </Box>
                  <Typography
                    fontSize={14}
                    fontFamily='Space Grotesk'
                    fontWeight={500}
                    color={theme.palette.text.primary}
                  >
                    €{MOCK_DATA.feeInfo.processing_fee.toFixed(2)}
                  </Typography>
                </Box>

                {/* Fee Payer Indicator */}
                <Box display='flex' alignItems='center' mb={1} gap={0.5}>
                  <Typography
                    fontSize={12}
                    fontFamily='Space Grotesk'
                    color="#12B76A"
                  >
                    {t('checkout.processingFeesIncluded')}
                  </Typography>
                </Box>

                <Divider sx={{ my: 1.5, borderColor: isDark ? theme.palette.surface.border : undefined }} />

                {/* Total Row */}
                <Box
                  display='flex'
                  justifyContent='space-between'
                  alignItems='center'
                  mb={2}
                >
                  <Typography
                    fontFamily='Space Grotesk'
                    fontWeight={600}
                    fontSize={{ xs: 14, sm: 18 }}
                    color={theme.palette.text.primary}
                  >
                    {t('checkout.total')}
                  </Typography>

                  <Box display='flex' alignItems='center' gap={1}>
                    <Typography
                      fontWeight={600}
                      fontFamily='Space Grotesk'
                      fontSize={{ xs: 16, sm: 22 }}
                      color={theme.palette.text.primary}
                      data-testid="total-amount"
                    >
                      €{MOCK_DATA.totalAmount.toFixed(2)} EUR
                    </Typography>
                    <Icon
                      icon='solar:alt-arrow-down-linear'
                      width='17'
                      height='17'
                      color={theme.palette.text.primary}
                    />
                  </Box>
                </Box>

                <Divider sx={{ mb: 2, borderColor: isDark ? theme.palette.surface.border : undefined }} />

                <Box display='flex' gap={2}>
                  <Button
                    fullWidth
                    variant='outlined'
                    startIcon={<BitCoinGreenIcon width={8.25} />}
                    data-testid="crypto-payment-btn"
                    sx={{
                      borderColor: '#12B76A',
                      color: '#12B76A',
                      textTransform: 'none',
                      borderRadius: 30,
                      fontFamily: 'Space Grotesk',
                      fontWeight: '500',
                      py: { xs: 1.5, sm: 2 },
                      fontSize: '16px',
                      minHeight: 56,
                      '&:hover': {
                        backgroundColor: isDark ? 'rgba(18, 183, 106, 0.1)' : '#ECFDF5',
                        borderColor: '#12B76A'
                      }
                    }}
                  >
                    {t('checkout.cryptocurrency')}
                  </Button>
                </Box>
              </Box>

              {/* Expiry Countdown */}
              <Box 
                display='flex' 
                alignItems='center' 
                justifyContent='center' 
                gap={1} 
                mt={2}
                data-testid="expiry-countdown"
              >
                <Icon icon="mdi:clock-outline" width={16} color={isDark ? theme.palette.text.secondary : '#666'} />
                <Typography
                  fontSize={13}
                  fontFamily='Space Grotesk'
                  color={isDark ? theme.palette.text.secondary : '#666'}
                >
                  {t('checkout.expiresIn')} <strong>{countdown}</strong>
                </Typography>
              </Box>

              {/* Security Badge */}
              <Box mt={2}>
                <Box 
                  display='flex' 
                  alignItems='center' 
                  justifyContent='center' 
                  gap={0.5} 
                  data-testid="security-badge"
                >
                  <Icon icon="mdi:lock" width={14} color={isDark ? '#6C7BFF' : '#444CE7'} />
                  <Typography
                    fontSize={12}
                    fontFamily='Space Grotesk'
                    color={isDark ? '#6C7BFF' : '#444CE7'}
                    fontWeight={500}
                  >
                    {t('checkout.securePayment')}
                  </Typography>
                </Box>
              </Box>
            </Paper>
          </Box>
        </Box>

        {/* Copy Success Snackbar */}
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
