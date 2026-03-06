'use client'

import { Box, IconButton, useTheme } from '@mui/material'
import XIcon from '@mui/icons-material/X'
import Link from 'next/link'
import InstagramIcon from '@mui/icons-material/Instagram'
import { useTranslation } from 'react-i18next'

export default function Footer () {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const { t } = useTranslation('common');
  
  return (
    <Box component='footer' width='100%' >
      {/* Icon Row */}
      <Box display='flex' justifyContent='center' py={2}>
        <IconButton>
          <InstagramIcon sx={{ color: isDark ? '#6C7BFF' : '#2D3282' }} />
        </IconButton>
        <IconButton>
          <XIcon sx={{ color: isDark ? '#6C7BFF' : '#2D3282' }} />
        </IconButton>
      </Box>

      {/* Footer Bar */}
      <Box
        bgcolor={isDark ? '#1a1a2e' : '#2D3282'}
        py={1}
        textAlign='center'
        sx={{ 
          width: '100%', 
          color: '#fff', 
          height: '46px',
          transition: 'background-color 0.3s ease',
        }}
      >
        <Link
          href={'/pay/terms-of-service'}
          style={{
            color: '#fff',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: '400'
          }}
        >
          {t('footer.termsOfService')}
        </Link>
        <span> | </span>
        <Link href={'/pay/aml-policy'} style={{ color: '#fff', cursor: 'pointer', fontSize:'14px', fontWeight:"400" }}>
          {t('footer.amlPolicy')}
        </Link>
      </Box>
    </Box>
  )
}
