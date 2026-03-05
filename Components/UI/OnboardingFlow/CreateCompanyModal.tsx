import InputField from "@/Components/UI/AuthLayout/InputFields";
import CustomButton from "@/Components/UI/Buttons";
import useIsMobile from "@/hooks/useIsMobile";
import { CompanyAction } from "@/Redux/Actions";
import { COMPANY_INSERT } from "@/Redux/Actions/CompanyAction";
import { rootReducer } from "@/utils/types";
import {
  BusinessRounded,
  CloudUploadRounded,
} from "@mui/icons-material";
import {
  Box,
  Dialog,
  Slide,
  Typography,
  useTheme,
} from "@mui/material";
import StepIndicator from "./StepIndicator";
import { TransitionProps } from "@mui/material/transitions";
import { MuiTelInput } from "mui-tel-input";
import React, { useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";

const Transition = React.forwardRef(function Transition(
  props: TransitionProps & { children: React.ReactElement<any, any> },
  ref: React.Ref<unknown>,
) {
  return <Slide direction="up" ref={ref} {...props} />;
});

interface CreateCompanyModalProps {
  open: boolean;
  onSuccess: () => void;
}

const CreateCompanyModal: React.FC<CreateCompanyModalProps> = ({
  open,
  onSuccess,
}) => {
  const theme = useTheme();
  const dispatch = useDispatch();
  const isMobile = useIsMobile("sm");
  const companyState = useSelector(
    (state: rootReducer) => state.companyReducer,
  );
  const fileRef = useRef<HTMLInputElement>(null);

  const [companyName, setCompanyName] = useState("");
  const [email, setEmail] = useState("");
  const [mobile, setMobile] = useState("");
  const [website, setWebsite] = useState("");
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState("");
  const [imagePreview, setImagePreview] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!companyName.trim()) newErrors.companyName = "Company name is required";
    if (!email.trim()) newErrors.email = "Email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      newErrors.email = "Please enter a valid email";
    if (!mobile || mobile.replace(/\D/g, "").length < 10)
      newErrors.mobile = "Valid mobile number is required";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleFileChange = (file: File) => {
    setMediaFile(file);
    setFileName(file.name);
    setImagePreview(URL.createObjectURL(file));
  };

  const handleSubmit = async () => {
    if (!validate() || submitting) return;
    setSubmitting(true);

    const values = {
      company_name: companyName.trim(),
      email: email.trim(),
      mobile,
      website: website.trim(),
    };

    const formData = new FormData();
    formData.append("data", JSON.stringify(values));
    if (mediaFile) formData.append("image", mediaFile);

    dispatch(CompanyAction(COMPANY_INSERT, formData));
  };

  // Watch for successful company creation
  const prevLoading = useRef(false);
  React.useEffect(() => {
    if (prevLoading.current && !companyState.loading) {
      if (companyState.companyList?.length > 0) {
        setSubmitting(false);
        onSuccess();
      } else {
        setSubmitting(false);
      }
    }
    prevLoading.current = companyState.loading;
  }, [companyState.loading, companyState.companyList, onSuccess]);

  return (
    <Dialog
      open={open}
      TransitionComponent={Transition}
      maxWidth="sm"
      fullWidth
      disableEscapeKeyDown
      PaperProps={{
        sx: {
          borderRadius: "16px",
          overflow: "hidden",
          maxWidth: isMobile ? "95vw" : "520px",
          mx: "auto",
        },
      }}
      data-testid="create-company-modal"
    >
      {/* Step Indicator */}
      <Box
        sx={{
          px: isMobile ? 2.5 : 3.5,
          pt: isMobile ? 2 : 2.5,
          pb: 0,
        }}
      >
        <StepIndicator currentStep={1} totalSteps={2} />
      </Box>

      {/* Header */}
      <Box
        sx={{
          px: isMobile ? 2.5 : 3.5,
          pt: isMobile ? 1.5 : 2,
          pb: 0,
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 0.5 }}>
          <Box
            sx={{
              width: 40,
              height: 40,
              borderRadius: "10px",
              backgroundColor: theme.palette.primary.light || "#E5EDFF",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <BusinessRounded
              sx={{ fontSize: 22, color: theme.palette.primary.main }}
            />
          </Box>
          <Box>
            <Typography
              data-testid="create-company-title"
              sx={{
                fontSize: isMobile ? "18px" : "20px",
                fontFamily: "UrbanistSemibold",
                fontWeight: 700,
                color: theme.palette.text.primary,
                lineHeight: 1.3,
              }}
            >
              Create Your Company
            </Typography>
            <Typography
              sx={{
                fontSize: isMobile ? "12px" : "13px",
                fontFamily: "UrbanistMedium",
                fontWeight: 500,
                color: theme.palette.text.secondary,
                lineHeight: 1.4,
              }}
            >
              Set up your business profile to start accepting payments
            </Typography>
          </Box>
        </Box>
      </Box>

      {/* Form */}
      <Box
        sx={{
          px: isMobile ? 2.5 : 3.5,
          py: isMobile ? 2 : 2.5,
          display: "flex",
          flexDirection: "column",
          gap: "14px",
        }}
      >
        <InputField
          label="Company Name *"
          placeholder="Enter your company name"
          value={companyName}
          onChange={(e) => {
            setCompanyName(e.target.value);
            if (errors.companyName) setErrors({ ...errors, companyName: "" });
          }}
          error={!!errors.companyName}
          helperText={errors.companyName}
          data-testid="company-name-input"
        />

        <InputField
          label="Business Email *"
          placeholder="Enter your business email"
          type="email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (errors.email) setErrors({ ...errors, email: "" });
          }}
          error={!!errors.email}
          helperText={errors.email}
          data-testid="company-email-input"
        />

        <Box>
          <Typography
            sx={{
              fontSize: "13px",
              fontWeight: 500,
              fontFamily: "UrbanistMedium",
              color: theme.palette.text.primary,
              mb: 0.5,
              ml: 0.25,
            }}
          >
            Mobile Number *
          </Typography>
          <MuiTelInput
            fullWidth
            placeholder="Enter mobile number"
            forceCallingCode
            disableFormatting
            defaultCountry="US"
            value={mobile}
            error={!!errors.mobile}
            helperText={errors.mobile}
            onChange={(newValue) => {
              setMobile(newValue);
              if (errors.mobile) setErrors({ ...errors, mobile: "" });
            }}
            sx={{
              "& .MuiOutlinedInput-root": {
                borderRadius: "10px",
                fontSize: isMobile ? "13px" : "15px",
                fontFamily: "UrbanistMedium",
                height: isMobile ? "40px" : "44px",
                "& fieldset": {
                  borderColor: errors.mobile
                    ? theme.palette.error.main
                    : "#E9ECF2",
                },
                "&:hover fieldset": {
                  borderColor: errors.mobile
                    ? theme.palette.error.main
                    : "#D0D5DD",
                },
                "&.Mui-focused fieldset": {
                  borderColor: errors.mobile
                    ? theme.palette.error.main
                    : theme.palette.primary.main,
                },
              },
              "& .MuiFormHelperText-root": {
                fontFamily: "UrbanistMedium",
                fontSize: "12px",
                marginLeft: "4px",
              },
            }}
            data-testid="company-mobile-input"
          />
        </Box>

        <InputField
          label="Website (optional)"
          placeholder="https://yourcompany.com"
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
          data-testid="company-website-input"
        />

        {/* Logo upload */}
        <Box>
          <Typography
            sx={{
              fontSize: "13px",
              fontWeight: 500,
              fontFamily: "UrbanistMedium",
              color: theme.palette.text.primary,
              mb: 0.75,
              ml: 0.25,
            }}
          >
            Brand Logo (optional)
          </Typography>
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1.5,
            }}
          >
            <Box
              onClick={() => fileRef.current?.click()}
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 0.75,
                px: 1.5,
                py: 0.75,
                borderRadius: "8px",
                border: `1px solid #E9ECF2`,
                cursor: "pointer",
                transition: "background-color 0.15s",
                "&:hover": { backgroundColor: "#F4F6FA" },
              }}
            >
              <CloudUploadRounded
                sx={{ fontSize: 16, color: theme.palette.text.secondary }}
              />
              <Typography
                sx={{
                  fontSize: "13px",
                  fontFamily: "UrbanistMedium",
                  fontWeight: 500,
                  color: theme.palette.text.secondary,
                }}
              >
                {fileName ? "Change" : "Upload"}
              </Typography>
            </Box>
            {imagePreview && (
              <Box
                component="img"
                src={imagePreview}
                alt="logo preview"
                sx={{
                  width: 36,
                  height: 36,
                  borderRadius: "8px",
                  objectFit: "cover",
                  border: `1px solid #E9ECF2`,
                }}
              />
            )}
            {fileName && !imagePreview && (
              <Typography
                sx={{
                  fontSize: "12px",
                  color: theme.palette.text.secondary,
                  fontFamily: "UrbanistMedium",
                }}
              >
                {fileName}
              </Typography>
            )}
            <input
              type="file"
              ref={fileRef}
              hidden
              accept="image/*"
              onChange={(e) => {
                if (e.target.files?.[0]) handleFileChange(e.target.files[0]);
              }}
            />
          </Box>
        </Box>
      </Box>

      {/* Footer */}
      <Box
        sx={{
          px: isMobile ? 2.5 : 3.5,
          pb: isMobile ? 2.5 : 3,
          pt: 0.5,
        }}
      >
        <CustomButton
          data-testid="create-company-submit-btn"
          label={submitting ? "Creating..." : "Create Company"}
          variant="primary"
          size={isMobile ? "small" : "medium"}
          fullWidth
          disabled={submitting}
          onClick={handleSubmit}
        />
      </Box>
    </Dialog>
  );
};

export default CreateCompanyModal;
