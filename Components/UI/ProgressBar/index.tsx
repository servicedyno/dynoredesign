'use client'

import {
  Stepper,
  Step,
  StepLabel,
  StepConnector,
  stepConnectorClasses,
  Typography,
  IconButton,
  Box
} from '@mui/material'
import { styled } from '@mui/material/styles'
import CheckIcon from '@mui/icons-material/Check'
import ArrowBackIosNewIcon from '@mui/icons-material/ArrowBackIosNew'

const CustomConnector = styled(StepConnector)(({ theme }) => ({
  [`&.${stepConnectorClasses.alternativeLabel}`]: {
    top: 14
  },
  [`& .${stepConnectorClasses.line}`]: {
    height: 2,
    border: 0,
    backgroundColor: '#CBD5E1', // gray line
    borderRadius: 1
  },
  [`&.${stepConnectorClasses.active} .${stepConnectorClasses.line}`]: {
    backgroundColor: '#4F46E5' // active step line
  },
  [`&.${stepConnectorClasses.completed} .${stepConnectorClasses.line}`]: {
    backgroundColor: '#4F46E5' // completed line
  }
}))

const StepIconRoot = styled('div')<{
  ownerState: { completed: boolean; active: boolean }
}>(({ ownerState }) => ({
  backgroundColor: ownerState.completed ? '#4F46E5' : '#fff',
  zIndex: 1,
  color: ownerState.completed ? '#fff' : '#4F46E5',
  width: 28,
  height: 28,
  display: 'flex',
  border: '2px solid #4F46E5',
  borderRadius: '50%',
  justifyContent: 'center',
  alignItems: 'center'
}))

function StepIconComponent (props: any) {
  const { active, completed } = props

  return (
    <StepIconRoot ownerState={{ completed, active }}>
      {completed ? (
        <CheckIcon style={{ fontSize: 16, color: '#fff' }} />
      ) : (
        <div
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: active ? '#4F46E5' : '#CBD5E1'
          }}
        />
      )}
    </StepIconRoot>
  )
}

const steps = ['Order Info', 'Payment', 'Confirmation']

export default function ProgressBar({ activeStep }: { activeStep: number }) {
  return (
    <Box
      sx={{ width: '100%', px: 4, py: 3, }}
    >
      {/* {activeStep === 2 ? (
        <Box display='flex' alignItems='center' mb={2} height={35}>
      
        </Box>
      ) : (
        // <Box display='flex' alignItems='center' mb={2}>
        //   <IconButton>
        //     <ArrowBackIosNewIcon fontSize='small' />
        //   </IconButton>

        //   <Typography variant='body2' sx={{ fontFamily: "Space Grotesk", fontWeight: '500', fontSize: '14px' }}>
        //     Back
        //   </Typography>
        // </Box>
      )} */}
      <Stepper
        alternativeLabel
        activeStep={activeStep}
        connector={<CustomConnector />}
      >
        {steps.map(label => (
          <Step key={label}>
            <StepLabel StepIconComponent={StepIconComponent}>
              <Typography
                variant='caption'
                fontWeight={500}
                color='text.secondary'
              >
                {/* {label} */}
              </Typography>
            </StepLabel>
          </Step>
        ))}
      </Stepper>
    </Box>
  )
}
