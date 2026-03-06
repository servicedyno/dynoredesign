import React, { useEffect, useState, useCallback } from 'react'
import { 
  Box, 
  Typography, 
  Button, 
  Card, 
  useTheme, 
  CircularProgress,
  IconButton,
  Tooltip,
  Snackbar
} from '@mui/material'
import AccessTimeOutlinedIcon from '@mui/icons-material/AccessTimeOutlined'
import DoneIcon from '@mui/icons-material/Done'
import { Icon } from '@iconify/react'
import CopyIcon from '@/assets/Icons/CopyIcon'
import { useTranslation } from 'react-i18next'

interface TransferExpectedCardProps {
  isTrue?: boolean
  type: string
  dataUrl: string
  redirectUrl?: string | null
  transactionId?: string
  merchantName?: string
  amount?: string
  email?: string
  customerName?: string
}

export default function TransferExpectedCard({
  isTrue,
  type,
  dataUrl,
  redirectUrl,
  transactionId,
  merchantName,
  amount,
  email,
  customerName
}: TransferExpectedCardProps) {
  const theme = useTheme()
  const isDark = theme.palette.mode === 'dark'
  const { t } = useTranslation('common')
  
  const [countdown, setCountdown] = useState(5)
  const [isAutoRedirecting, setIsAutoRedirecting] = useState(false)
  const [showDoneState, setShowDoneState] = useState(false)
  const [copySnackbar, setCopySnackbar] = useState(false)

  // Auto-redirect after 5 seconds if redirectUrl is provided and payment is successful
  useEffect(() => {
    if (isTrue && redirectUrl && transactionId) {
      setIsAutoRedirecting(true)
      
      const timer = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(timer)
            handleRedirect()
            return 0
          }
          return prev - 1
        })
      }, 1000)

      return () => clearInterval(timer)
    }
  }, [isTrue, redirectUrl, transactionId])

  const handleRedirect = useCallback(() => {
    if (!redirectUrl || !transactionId) return
    
    try {
      const url = new URL(redirectUrl)
      url.searchParams.set('transaction_id', transactionId)
      url.searchParams.set('status', 'success')
      window.location.href = url.toString()
    } catch (e) {
      const separator = redirectUrl.includes('?') ? '&' : '?'
      window.location.href = `${redirectUrl}${separator}transaction_id=${transactionId}&status=success`
    }
  }, [redirectUrl, transactionId])

  const handleCopyTransactionId = useCallback(async () => {
    if (transactionId) {
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(transactionId)
        } else {
          const textArea = document.createElement('textarea')
          textArea.value = transactionId
          textArea.style.position = 'fixed'
          textArea.style.left = '-999999px'
          document.body.appendChild(textArea)
          textArea.focus()
          textArea.select()
          document.execCommand('copy')
          document.body.removeChild(textArea)
        }
        setCopySnackbar(true)
      } catch {
        const textArea = document.createElement('textarea')
        textArea.value = transactionId
        textArea.style.position = 'fixed'
        textArea.style.left = '-999999px'
        document.body.appendChild(textArea)
        textArea.focus()
        textArea.select()
        document.execCommand('copy')
        document.body.removeChild(textArea)
        setCopySnackbar(true)
      }
    }
  }, [transactionId])

  const handleDone = () => {
    setShowDoneState(true)
  }

  // Done state - final thank you screen
  if (showDoneState) {
    return (
      <Box
        display='flex'
        alignItems='center'
        justifyContent='center'
        bgcolor={isDark ? theme.palette.background.default : '#f6f8fc'}
        px={2}
        minHeight={'calc(100vh - 340px)'}
      >
        <Card
          sx={{
            width: 400,
            borderRadius: '16px',
            boxShadow: isDark 
              ? '0 45px 65px rgba(0, 0, 0, 0.3)' 
              : '0 45px 65px rgba(13, 3, 35, 0.06)',
            overflow: 'hidden',
            textAlign: 'center',
            backgroundColor: theme.palette.background.paper
          }}
        >
          <Box
            sx={{
              py: 4,
              background: isDark 
                ? 'radial-gradient(circle at top center, rgba(18, 183, 106, 0.15), transparent 70%)'
                : 'radial-gradient(circle at top center, #e8f9f1, #ffffff 70%)'
            }}
          >
            <DoneIcon sx={{ fontSize: 56, color: '#12B76A' }} />
          </Box>
          <Box px={4} pb={4}>
            <Typography
              variant='h6'
              fontWeight={600}
              color={theme.palette.text.primary}
              mb={1}
              fontFamily='Space Grotesk'
            >
              {customerName ? t('success.thankYouName', { name: customerName, defaultValue: `Thank you, ${customerName}!` }) : t('success.thankYou')}
            </Typography>
            <Box 
              display='flex' 
              alignItems='center' 
              justifyContent='center' 
              gap={0.5}
              mt={2}
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
        </Card>
      </Box>
    )
  }

  // Success state with payment confirmed
  if (isTrue) {
    return (
      <Box
        display='flex'
        alignItems='center'
        justifyContent='center'
        bgcolor={isDark ? theme.palette.background.default : '#f6f8fc'}
        px={2}
        minHeight={'calc(100vh - 340px)'}
      >
        <Card
          data-testid="success-card"
          sx={{
            width: 420,
            borderRadius: '16px',
            boxShadow: isDark 
              ? '0 45px 65px rgba(0, 0, 0, 0.3)' 
              : '0 45px 65px rgba(13, 3, 35, 0.06)',
            overflow: 'hidden',
            textAlign: 'center',
            backgroundColor: theme.palette.background.paper
          }}
        >
          {/* Success Icon with gradient background */}
          <Box
            sx={{
              py: 3,
              background: isDark 
                ? 'radial-gradient(circle at top center, rgba(18, 183, 106, 0.15), transparent 70%)'
                : 'radial-gradient(circle at top center, #e8f9f1, #ffffff 70%)'
            }}
          >
            <Box
              sx={{
                width: 64,
                height: 64,
                borderRadius: '50%',
                backgroundColor: '#12B76A',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto',
                animation: 'scaleIn 0.3s ease-out'
              }}
            >
              <DoneIcon sx={{ fontSize: 36, color: '#fff' }} />
            </Box>
          </Box>

          {/* Content */}
          <Box px={4} pb={4}>
            <Typography
              variant='h5'
              fontWeight={600}
              color={theme.palette.text.primary}
              mb={1}
              fontFamily='Space Grotesk'
              data-testid="success-title"
            >
              {customerName 
                ? t('success.paymentSuccessfulName', { name: customerName, defaultValue: `Payment Successful, ${customerName}!` })
                : t('success.paymentSuccessful')
              }
            </Typography>

            {/* Amount paid info */}
            <Typography
              variant='body1'
              color={isDark ? theme.palette.text.secondary : '#515151'}
              mb={3}
              fontFamily='Space Grotesk'
            >
              {merchantName && amount
                ? t('success.paidTo', { amount, merchant: merchantName })
                : amount
                ? t('success.paidAmount', { amount })
                : t('success.paymentConfirmed')
              }
            </Typography>

            {/* Transaction ID Box - prominent when no email */}
            {transactionId && (
              <Box
                sx={{
                  border: `1px solid ${isDark ? theme.palette.divider : '#E7EAFD'}`,
                  borderRadius: '10px',
                  p: 2,
                  mb: 2,
                  backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : '#FAFBFF'
                }}
                data-testid="transaction-box"
              >
                <Typography
                  fontSize={11}
                  fontWeight={600}
                  color={isDark ? theme.palette.text.secondary : '#666'}
                  fontFamily='Space Grotesk'
                  letterSpacing={0.5}
                  mb={0.5}
                >
                  {t('success.transactionId')}
                </Typography>
                <Box display='flex' alignItems='center' justifyContent='space-between'>
                  <Typography
                    fontWeight={600}
                    fontSize={15}
                    color={theme.palette.text.primary}
                    fontFamily='Space Grotesk'
                    data-testid="transaction-id"
                  >
                    #{transactionId}
                  </Typography>
                  <Tooltip title={t('common.copy')}>
                    <IconButton
                      size='small'
                      onClick={handleCopyTransactionId}
                      data-testid="copy-transaction-btn"
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
                {!email && (
                  <Typography
                    fontSize={11}
                    color={isDark ? theme.palette.text.secondary : '#888'}
                    fontFamily='Space Grotesk'
                    mt={1}
                  >
                    {t('success.saveForRecords')}
                  </Typography>
                )}
              </Box>
            )}

            {/* Email confirmation notice */}
            {email && (
              <Box 
                display='flex' 
                alignItems='center' 
                justifyContent='center' 
                gap={0.5} 
                mb={2}
              >
                <Icon icon="mdi:email-check" width={16} color="#12B76A" />
                <Typography
                  fontSize={13}
                  fontFamily='Space Grotesk'
                  color={isDark ? theme.palette.text.secondary : '#666'}
                >
                  {t('success.confirmationSent', { email })}
                </Typography>
              </Box>
            )}

            {/* Redirect countdown */}
            {isAutoRedirecting && redirectUrl && (
              <Box 
                display='flex' 
                alignItems='center' 
                justifyContent='center' 
                gap={1} 
                mb={2}
                data-testid="redirect-countdown"
              >
                <CircularProgress size={16} sx={{ color: '#444CE7' }} />
                <Typography
                  fontSize={13}
                  fontFamily='Space Grotesk'
                  color={isDark ? theme.palette.text.secondary : '#515151'}
                >
                  {merchantName 
                    ? t('success.redirectingTo', { merchant: merchantName })
                    : t('success.redirectingIn', { seconds: countdown })
                  }
                </Typography>
              </Box>
            )}

            {/* CTA Buttons */}
            {redirectUrl ? (
              // With redirect: Show "Return to Merchant" button
              <Box>
                <Button
                  fullWidth
                  variant='contained'
                  onClick={handleRedirect}
                  data-testid="return-btn"
                  sx={{
                    backgroundColor: '#4F46E5',
                    color: '#fff',
                    textTransform: 'none',
                    borderRadius: 30,
                    py: 1.75,
                    fontSize: '15px',
                    fontWeight: 600,
                    fontFamily: 'Space Grotesk',
                    '&:hover': {
                      backgroundColor: '#4338CA'
                    }
                  }}
                  endIcon={<Icon icon="mdi:arrow-right" width={18} />}
                >
                  {merchantName 
                    ? t('success.returnTo', { merchant: merchantName })
                    : t('success.returnTo', { merchant: 'Merchant' })
                  }
                </Button>
                <Typography
                  fontSize={12}
                  color={isDark ? theme.palette.text.secondary : '#888'}
                  fontFamily='Space Grotesk'
                  mt={1.5}
                  sx={{ cursor: 'pointer', '&:hover': { textDecoration: 'underline' } }}
                  onClick={handleRedirect}
                >
                  {t('success.clickIfNotRedirected')}
                </Typography>
              </Box>
            ) : (
              // Without redirect: Show "Done" button
              <Button
                fullWidth
                variant='contained'
                onClick={handleDone}
                data-testid="done-btn"
                sx={{
                  backgroundColor: '#4F46E5',
                  color: '#fff',
                  textTransform: 'none',
                  borderRadius: 30,
                  py: 1.75,
                  fontSize: '15px',
                  fontWeight: 600,
                  fontFamily: 'Space Grotesk',
                  '&:hover': {
                    backgroundColor: '#4338CA'
                  }
                }}
              >
                {t('success.done')}
              </Button>
            )}

            {/* Security badge */}
            <Box 
              display='flex' 
              alignItems='center' 
              justifyContent='center' 
              gap={0.5}
              mt={2}
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
        </Card>

        <Snackbar
          open={copySnackbar}
          autoHideDuration={2000}
          onClose={() => setCopySnackbar(false)}
          message={t('checkout.copied')}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        />
      </Box>
    )
  }

  // For crypto type, if not confirmed yet, don't show pending state
  // Crypto either succeeds or the user is still on the payment screen
  if (type === 'crypto' && !isTrue) {
    // Return null or a minimal waiting state for crypto
    // In practice, crypto flow handles its own waiting state in CryptoTransfer component
    return null
  }

  // Pending/Waiting state - transfer expected (BANK TRANSFERS ONLY)
  return (
    <Box
      display='flex'
      alignItems='center'
      justifyContent='center'
      bgcolor={isDark ? theme.palette.background.default : '#f6f8fc'}
      px={2}
      minHeight={'calc(100vh - 340px)'}
    >
      <Card
        data-testid="pending-card"
        sx={{
          width: 400,
          borderRadius: '16px',
          boxShadow: isDark 
            ? '0 45px 65px rgba(0, 0, 0, 0.3)' 
            : '0 45px 65px rgba(13, 3, 35, 0.06)',
          overflow: 'hidden',
          textAlign: 'center',
          backgroundColor: theme.palette.background.paper
        }}
      >
        {/* Pending Icon */}
        <Box
          sx={{
            py: 3,
            position: 'relative'
          }}
        >
          <Box
            sx={{
              position: 'absolute',
              bottom: '0',
              left: '50%',
              transform: 'translateX(-50%)',
              width: '400px',
              height: '530px',
              background:
                'radial-gradient(circle, rgba(251, 188, 5, 0.27) 0%, rgba(251, 188, 5, 0.0) 70%)',
              zIndex: 1
            }}
          />
          <AccessTimeOutlinedIcon
            sx={{
              fontSize: 50,
              color: '#FBBC05',
              position: 'relative',
              zIndex: 2
            }}
          />
        </Box>

        {/* Content */}
        <Box px={4} pb={4}>
          <Typography
            variant='h6'
            fontWeight={600}
            color={theme.palette.text.primary}
            mb={1}
            fontFamily='Space Grotesk'
          >
            {t('success.transferExpected')}
          </Typography>

          <Typography
            variant='body2'
            color={isDark ? theme.palette.text.secondary : '#515151'}
            mb={3}
            fontFamily='Space Grotesk'
          >
            {t('success.transferPending')}
          </Typography>

          {/* Transaction ID for pending state */}
          {transactionId && (
            <Box
              sx={{
                border: `1px solid ${isDark ? theme.palette.divider : '#E7EAFD'}`,
                borderRadius: '10px',
                p: 2,
                mb: 3,
                backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : '#FAFBFF'
              }}
            >
              <Box display='flex' alignItems='center' justifyContent='space-between'>
                <Box textAlign='left'>
                  <Typography
                    fontSize={10}
                    fontWeight={600}
                    color={isDark ? theme.palette.text.secondary : '#666'}
                    fontFamily='Space Grotesk'
                    letterSpacing={0.5}
                  >
                    {t('success.transactionId')}
                  </Typography>
                  <Typography
                    fontWeight={500}
                    fontSize={13}
                    color={theme.palette.text.primary}
                    fontFamily='Space Grotesk'
                  >
                    #{transactionId}
                  </Typography>
                </Box>
                <Tooltip title={t('common.copy')}>
                  <IconButton
                    size='small'
                    onClick={handleCopyTransactionId}
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
          )}

          {/* Done button for pending state */}
          <Button
            fullWidth
            variant='outlined'
            onClick={handleDone}
            sx={{
              borderColor: '#4F46E5',
              color: '#4F46E5',
              textTransform: 'none',
              borderRadius: 30,
              py: 1.5,
              fontFamily: 'Space Grotesk',
              fontWeight: 500,
              '&:hover': {
                backgroundColor: isDark ? 'rgba(79, 70, 229, 0.1)' : '#EEF2FF',
                borderColor: '#4F46E5'
              }
            }}
          >
            {t('success.done')}
          </Button>
        </Box>
      </Card>

      <Snackbar
        open={copySnackbar}
        autoHideDuration={2000}
        onClose={() => setCopySnackbar(false)}
        message={t('checkout.copied')}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
    </Box>
  )
}
