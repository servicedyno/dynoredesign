'use client'

import {
  Stepper,
  Step,
  StepLabel,
  StepConnector,
  stepConnectorClasses,
  Box,
  Typography,
  useTheme
} from '@mui/material'
import { styled } from '@mui/material/styles'
import CheckIcon from '@mui/icons-material/Check'

const CustomConnector = styled(StepConnector)(({ theme }) => ({
  [`&.${stepConnectorClasses.alternativeLabel}`]: {
    top: 11,
    left: 'calc(-50% + 14px)',
    right: 'calc(50% + 14px)',
  },
  [`& .${stepConnectorClasses.line}`]: {
    height: 2,
    border: 0,
    backgroundColor: theme.palette.mode === 'dark' ? '#2a2a4a' : '#E0E4ED',
    borderRadius: 1,
    transition: 'background-color 0.4s ease',
  },
  [`&.${stepConnectorClasses.active} .${stepConnectorClasses.line}`]: {
    background: 'linear-gradient(90deg, #0004FF 0%, #3D40FF 100%)',
  },
  [`&.${stepConnectorClasses.completed} .${stepConnectorClasses.line}`]: {
    background: 'linear-gradient(90deg, #0004FF 0%, #3D40FF 100%)',
  },
}))

const StepIconRoot = styled('div')<{
  ownerState: { completed: boolean; active: boolean }
}>(({ theme, ownerState }) => ({
  backgroundColor: ownerState.completed
    ? '#0004FF'
    : ownerState.active
      ? '#fff'
      : theme.palette.mode === 'dark' ? '#1a1a2e' : '#fff',
  zIndex: 1,
  color: ownerState.completed ? '#fff' : '#0004FF',
  width: 24,
  height: 24,
  display: 'flex',
  border: `2px solid ${
    ownerState.active || ownerState.completed ? '#0004FF' : theme.palette.mode === 'dark' ? '#3a3a5a' : '#D0D5E0'
  }`,
  borderRadius: '50%',
  justifyContent: 'center',
  alignItems: 'center',
  transition: 'all 0.3s ease',
  boxShadow: ownerState.active ? '0 0 0 4px rgba(0,4,255,0.12)' : 'none',
}))

function StepIconComponent(props: any) {
  const { active, completed } = props

  return (
    <StepIconRoot ownerState={{ completed, active }}>
      {completed ? (
        <CheckIcon style={{ fontSize: 14, color: '#fff' }} />
      ) : (
        <div
          style={{
            width: 7,
            height: 7,
            borderRadius: '50%',
            background: active ? '#0004FF' : '#CBD5E1',
            transition: 'all 0.3s ease',
          }}
        />
      )}
    </StepIconRoot>
  )
}

const steps = ['Order', 'Payment', 'Done']

export default function ProgressBar({ activeStep }: { activeStep: number }) {
  const theme = useTheme()
  const isDark = theme.palette.mode === 'dark'

  return (
    <Box sx={{ width: '100%', maxWidth: 360, mx: 'auto', px: 2, pt: 1.5, pb: 0.5 }}>
      <Stepper
        alternativeLabel
        activeStep={activeStep}
        connector={<CustomConnector />}
      >
        {steps.map((label, idx) => (
          <Step key={label}>
            <StepLabel
              StepIconComponent={StepIconComponent}
              sx={{
                '& .MuiStepLabel-label': {
                  fontSize: '11px',
                  fontWeight: idx <= activeStep ? 700 : 500,
                  color: idx <= activeStep
                    ? (isDark ? '#fff' : '#242428')
                    : (isDark ? '#666' : '#9CA3AF'),
                  mt: '4px !important',
                  fontFamily: "'Urbanist', sans-serif",
                  letterSpacing: '0.3px',
                  transition: 'all 0.3s ease',
                },
              }}
            >
              {label}
            </StepLabel>
          </Step>
        ))}
      </Stepper>
    </Box>
  )
}
