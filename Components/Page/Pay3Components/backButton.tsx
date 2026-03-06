'use client'

import { Button } from '@mui/material'
import ArrowBackIosNewIcon from '@mui/icons-material/ArrowBackIosNew'

export default function BackButton({
  onClick,
  label = 'Back'
}: {
  onClick?: () => void
  label?: String
}) {
  return (
    <Button
      variant="outlined"
      onClick={onClick}
      startIcon={<ArrowBackIosNewIcon style={{width:'24px'}} />}
      sx={{
        borderRadius: '9999px', // fully rounded pill
        textTransform: 'none',
        fontWeight: 500,
        fontSize: '16px',
        px: 2.5,
        py: 1.5,
        borderColor: '#F7F7F7', // light gray border
        color: '#1A1919', // dark text
        backgroundColor: 'transparent',
        '&:hover': {
          backgroundColor: '#F9FAFB',
        },
        fontFamily: 'Space Grotesk'
      }}
    >
      {label}
    </Button>
  )
}
