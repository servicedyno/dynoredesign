'use client'

import { Box, Typography, useTheme } from '@mui/material'
import Link from 'next/link'
import { useTranslation } from 'react-i18next'

export default function Footer() {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const { t } = useTranslation('common');

  return (
    <Box
      component='footer'
      sx={{
        width: '100%',
        py: 1.5,
        textAlign: 'center',
        backgroundColor: isDark ? '#1a1a2e' : '#242428',
        transition: 'background-color 0.3s ease',
      }}
    >
      <Box display='flex' alignItems='center' justifyContent='center' gap={1.5}>
        <Link
          href='/pay/terms-of-service'
          style={{
            color: 'rgba(255,255,255,0.7)',
            fontSize: '12px',
            fontWeight: 500,
            textDecoration: 'none',
            fontFamily: "'Urbanist', sans-serif",
          }}
        >
          {t('footer.termsOfService')}
        </Link>
        <Typography sx={{ color: 'rgba(255,255,255,0.3)', fontSize: '12px' }}>|</Typography>
        <Link
          href='/pay/aml-policy'
          style={{
            color: 'rgba(255,255,255,0.7)',
            fontSize: '12px',
            fontWeight: 500,
            textDecoration: 'none',
            fontFamily: "'Urbanist', sans-serif",
          }}
        >
          {t('footer.amlPolicy')}
        </Link>
        <Typography sx={{ color: 'rgba(255,255,255,0.3)', fontSize: '12px' }}>|</Typography>
        <Typography
          sx={{
            color: 'rgba(255,255,255,0.4)',
            fontSize: '11px',
            fontFamily: "'Urbanist', sans-serif",
          }}
        >
          Powered by DynoPay
        </Typography>
      </Box>
    </Box>
  )
}
