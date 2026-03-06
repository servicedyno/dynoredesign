'use client'

import {
  Stepper,
  Step,
  StepLabel,
  StepConnector,
  stepConnectorClasses,
  Box
} from '@mui/material'
import { styled } from '@mui/material/styles'
import CheckIcon from '@mui/icons-material/Check'

const CustomConnector = styled(StepConnector)(() => ({
  [`&.${stepConnectorClasses.alternativeLabel}`]: {
    top: 10,
  },
  [`& .${stepConnectorClasses.line}`]: {
    height: 2,
    border: 0,
    backgroundColor: '#E9ECF2',
    borderRadius: 1,
  },
  [`&.${stepConnectorClasses.active} .${stepConnectorClasses.line}`]: {
    backgroundColor: '#0004FF',
  },
  [`&.${stepConnectorClasses.completed} .${stepConnectorClasses.line}`]: {
    backgroundColor: '#0004FF',
  },
}))

const StepIconRoot = styled('div')<{
  ownerState: { completed: boolean; active: boolean }
}>(({ ownerState }) => ({
  backgroundColor: ownerState.completed ? '#0004FF' : '#fff',
  zIndex: 1,
  color: ownerState.completed ? '#fff' : '#0004FF',
  width: 22,
  height: 22,
  display: 'flex',
  border: `2px solid ${ownerState.active || ownerState.completed ? '#0004FF' : '#CBD5E1'}`,
  borderRadius: '50%',
  justifyContent: 'center',
  alignItems: 'center',
}))

function StepIconComponent(props: any) {
  const { active, completed } = props

  return (
    <StepIconRoot ownerState={{ completed, active }}>
      {completed ? (
        <CheckIcon style={{ fontSize: 13, color: '#fff' }} />
      ) : (
        <div
          style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: active ? '#0004FF' : '#CBD5E1',
          }}
        />
      )}
    </StepIconRoot>
  )
}

const steps = ['Order', 'Payment', 'Done']

export default function ProgressBar({ activeStep }: { activeStep: number }) {
  return (
    <Box sx={{ width: '100%', maxWidth: 480, mx: 'auto', px: 2, pt: 1.5, pb: 1 }}>
      <Stepper
        alternativeLabel
        activeStep={activeStep}
        connector={<CustomConnector />}
      >
        {steps.map(label => (
          <Step key={label}>
            <StepLabel StepIconComponent={StepIconComponent} />
          </Step>
        ))}
      </Stepper>
    </Box>
  )
}
