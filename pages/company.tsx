import React, { useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useRouter } from "next/router";
import Head from "next/head";
import {
  Box,
  Button,
  CircularProgress,
  Grid,
  Typography,
  useTheme,
} from "@mui/material";
import {
  AddCircleOutlineRounded,
  BusinessRounded,
  EditRounded,
  EmailRounded,
  LanguageRounded,
  PhoneRounded,
} from "@mui/icons-material";
import { MuiTelInput } from "mui-tel-input";
import * as yup from "yup";

import FormManager from "@/Components/Page/Common/FormManager";
import PanelCard from "@/Components/UI/PanelCard";
import PopupModal from "@/Components/UI/PopupModal";
import TextBox from "@/Components/UI/TextBox";
import CompanySettingsDialog from "@/Components/UI/CompanySettingsDialog";
import useIsMobile from "@/hooks/useIsMobile";
import { CompanyAction } from "@/Redux/Actions";
import {
  COMPANY_FETCH,
  COMPANY_INSERT,
} from "@/Redux/Actions/CompanyAction";
import { ICompany, pageProps, rootReducer } from "@/utils/types";
import Dummy from "@/assets/Images/dummy.jpg";
import { CloudUploadRounded } from "@mui/icons-material";

const companyInitial = {
  company_name: "",
  email: "",
  mobile: "",
  website: "",
};

const Company = ({ setPageName, setPageDescription, setPageAction }: pageProps) => {
  const dispatch = useDispatch();
  const theme = useTheme();
  const router = useRouter();
  const isMobile = useIsMobile("md");
  const fileRef = useRef<any>();
  const companyState = useSelector(
    (state: rootReducer) => state.companyReducer
  );
  const userState = useSelector((state: rootReducer) => state.userReducer);

  const [addOpen, setAddOpen] = useState(false);
  const [mediaFile, setMediaFile] = useState<any>();
  const [fileName, setFileName] = useState<any>();
  const [image, setImage] = useState(Dummy.src);
  const [initialValue, setInitialValue] = useState(
    structuredClone(companyInitial)
  );

  // Manage dialog state
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState<ICompany | null>(null);

  const companySchema = yup.object().shape({
    company_name: yup.string().required("Company Name is required!"),
    email: yup
      .string()
      .email("Please enter a valid email")
      .required("Email is required!"),
    mobile: yup
      .string()
      .notRequired()
      .test(
        "mobile-len",
        "Minimum 10 digits are required!",
        (v) => !v || v.replace(/\D/g, "").length >= 10
      ),
  });

  useEffect(() => {
    setPageName("Companies");
    setPageDescription?.("Manage your business profiles and company settings");
    setPageAction?.(null);
    dispatch(CompanyAction(COMPANY_FETCH));
  }, []);

  // Auto-open settings dialog when ?section= is provided
  useEffect(() => {
    const section = router.query.section as string | undefined;
    if (section && companyState?.companyList?.length > 0 && !settingsOpen) {
      setSelectedCompany(companyState.companyList[0]);
      setSettingsOpen(true);
    }
  }, [router.query.section, companyState?.companyList]);

  const handleAddClose = () => {
    setInitialValue(structuredClone(companyInitial));
    setFileName(undefined);
    setMediaFile(undefined);
    setImage(Dummy.src);
    setAddOpen(false);
  };

  const handleAddSubmit = (values: any) => {
    const formData = new FormData();
    formData.append("data", JSON.stringify(values));
    if (mediaFile) formData.append("image", mediaFile);
    dispatch(CompanyAction(COMPANY_INSERT, formData));
    handleAddClose();
  };

  const handleFileChange = (file: File) => {
    if (file) {
      setImage(URL.createObjectURL(file));
      setFileName(file.name);
      setMediaFile(file);
    }
  };

  const handleManage = (company: ICompany) => {
    setSelectedCompany(company);
    setSettingsOpen(true);
  };

  const companies = companyState?.companyList || [];
  const isLoading = companyState?.loading && !companyState?.fetched;

  // Loading state (only show on initial fetch, not indefinitely)
  if (isLoading && companies.length === 0) {
    return (
      <Box
        sx={{
          height: "60vh",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <CircularProgress sx={{ color: theme.palette.primary.main }} />
      </Box>
    );
  }

  return (
    <>
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      {/* Header with Add button */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-end",
          mb: 2,
          px: { xs: 2, md: 0 },
        }}
      >
        <Button
          data-testid="add-company-btn"
          variant="rounded"
          sx={{ display: "flex", alignItems: "center" }}
          onClick={() => {
            setInitialValue({
              ...structuredClone(companyInitial),
              email: userState.email || "",
              mobile: userState.mobile || "",
            });
            setAddOpen(true);
          }}
        >
          <AddCircleOutlineRounded fontSize="small" sx={{ mr: 0.5 }} />
          Add Company
        </Button>
      </Box>

      {/* Empty State */}
      {companies.length === 0 && !companyState?.loading && (
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            py: 10,
            gap: 2,
          }}
        >
          <Box
            sx={{
              width: 64,
              height: 64,
              borderRadius: "16px",
              bgcolor: theme.palette.primary.main + "15",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <BusinessRounded
              sx={{ fontSize: 32, color: theme.palette.primary.main }}
            />
          </Box>
          <Typography
            sx={{
              fontFamily: "UrbanistSemibold",
              fontSize: "20px",
              fontWeight: 600,
              color: theme.palette.text.primary,
              mt: 1,
            }}
          >
            No companies yet
          </Typography>
          <Typography
            sx={{
              fontFamily: "UrbanistMedium",
              fontSize: "14px",
              color: theme.palette.text.secondary,
              textAlign: "center",
              maxWidth: 360,
            }}
          >
            Create your first company profile to start accepting payments and managing your business.
          </Typography>
          <Button
            data-testid="empty-add-company-btn"
            variant="rounded"
            sx={{ mt: 1, display: "flex", alignItems: "center", gap: 0.5 }}
            onClick={() => {
              setInitialValue({
                ...structuredClone(companyInitial),
                email: userState.email || "",
                mobile: userState.mobile || "",
              });
              setAddOpen(true);
            }}
          >
            <AddCircleOutlineRounded fontSize="small" />
            Add Company
          </Button>
        </Box>
      )}

      {/* Company Cards Grid */}
      {companies.length > 0 && (
        <Box
          sx={{
            width: "100%",
            display: "flex",
            flexDirection: "column",
            gap: "16px",
            pb: { xs: "70px", lg: "0" },
            px: { xs: 2, md: 0 },
          }}
        >
          <Grid container spacing={isMobile ? "12px" : 2.7}>
            {companies.map((company: ICompany, index: number) => (
              <Grid
                item
                xs={12}
                md={6}
                xl={4}
                key={company.company_id}
                sx={{
                  opacity: 0,
                  transform: "translateY(20px)",
                  animation: "cardFadeUp 0.5s ease forwards",
                  animationDelay: `${index * 0.12}s`,
                  "@keyframes cardFadeUp": {
                    "0%": { opacity: 0, transform: "translateY(20px)" },
                    "100%": { opacity: 1, transform: "translateY(0)" },
                  },
                }}
              >
                <PanelCard
                  title={company.company_name}
                  headerIcon={
                    <Box
                      sx={{
                        width: 48,
                        height: 48,
                        borderRadius: "50%",
                        border: `1px solid ${theme.palette.divider}`,
                        bgcolor: theme.palette.mode === "dark"
                          ? "rgba(255,255,255,0.06)"
                          : theme.palette.grey[100],
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        overflow: "hidden",
                        flexShrink: 0,
                      }}
                    >
                      {company.photo ? (
                        <img
                          src={company.photo}
                          alt={company.company_name}
                          crossOrigin="anonymous"
                          style={{
                            width: "100%",
                            height: "100%",
                            objectFit: "cover",
                          }}
                        />
                      ) : (
                        <Typography
                          sx={{
                            fontFamily: "UrbanistSemibold",
                            fontWeight: 700,
                            fontSize: "18px",
                            color: theme.palette.primary.main,
                          }}
                        >
                          {company.company_name?.charAt(0)?.toUpperCase()}
                        </Typography>
                      )}
                    </Box>
                  }
                  showHeaderBorder={false}
                  headerPadding={theme.spacing(2.5, 2.5, 0, 2.5)}
                  bodyPadding={
                    isMobile
                      ? theme.spacing(1.75, 2, 2, 2)
                      : theme.spacing(2, 2.5, 2.5, 2.5)
                  }
                >
                  <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
                    {/* Email */}
                    {company.email && (
                      <Box
                        sx={{
                          display: "flex",
                          alignItems: "center",
                          gap: 1,
                        }}
                      >
                        <EmailRounded
                          sx={{
                            fontSize: 16,
                            color: theme.palette.text.secondary,
                          }}
                        />
                        <Typography
                          sx={{
                            fontSize: isMobile ? "13px" : "14px",
                            fontFamily: "UrbanistMedium",
                            color: theme.palette.text.secondary,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {company.email}
                        </Typography>
                      </Box>
                    )}

                    {/* Phone */}
                    {company.mobile && (
                      <Box
                        sx={{
                          display: "flex",
                          alignItems: "center",
                          gap: 1,
                        }}
                      >
                        <PhoneRounded
                          sx={{
                            fontSize: 16,
                            color: theme.palette.text.secondary,
                          }}
                        />
                        <Typography
                          sx={{
                            fontSize: isMobile ? "13px" : "14px",
                            fontFamily: "UrbanistMedium",
                            color: theme.palette.text.secondary,
                          }}
                        >
                          {company.mobile}
                        </Typography>
                      </Box>
                    )}

                    {/* Website */}
                    {company.website && (
                      <Box
                        sx={{
                          display: "flex",
                          alignItems: "center",
                          gap: 1,
                        }}
                      >
                        <LanguageRounded
                          sx={{
                            fontSize: 16,
                            color: theme.palette.text.secondary,
                          }}
                        />
                        <Typography
                          sx={{
                            fontSize: isMobile ? "13px" : "14px",
                            fontFamily: "UrbanistMedium",
                            color: theme.palette.primary.main,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {company.website}
                        </Typography>
                      </Box>
                    )}

                    {/* Location */}
                    {(company.city || company.country) && (
                      <Typography
                        sx={{
                          fontSize: isMobile ? "12px" : "13px",
                          fontFamily: "UrbanistMedium",
                          color: theme.palette.text.secondary,
                          opacity: 0.8,
                        }}
                      >
                        {[company.city, company.state, company.country]
                          .filter(Boolean)
                          .join(", ")}
                      </Typography>
                    )}

                    {/* Manage Button */}
                    <Box
                      sx={{
                        display: "flex",
                        gap: 1,
                        mt: 0.5,
                      }}
                    >
                      <Button
                        data-testid={`manage-company-${company.company_id}`}
                        variant="outlined"
                        size="small"
                        onClick={() => handleManage(company)}
                        sx={{
                          borderRadius: "8px",
                          textTransform: "none",
                          fontFamily: "UrbanistMedium",
                          fontWeight: 500,
                          fontSize: "13px",
                          borderColor: theme.palette.divider,
                          color: theme.palette.text.primary,
                          "&:hover": {
                            borderColor: theme.palette.primary.main,
                            bgcolor: theme.palette.primary.main + "08",
                          },
                        }}
                        startIcon={
                          <EditRounded sx={{ fontSize: "16px !important" }} />
                        }
                      >
                        Manage
                      </Button>
                    </Box>
                  </Box>
                </PanelCard>
              </Grid>
            ))}
          </Grid>
        </Box>
      )}

      {/* Add Company Modal */}
      <PopupModal
        open={addOpen}
        showClose
        headerText="Add Company"
        handleClose={handleAddClose}
      >
        <Box sx={{ minWidth: isMobile ? "auto" : "700px", maxWidth: "100%" }}>
          <FormManager
            initialValues={initialValue}
            yupSchema={companySchema}
            onSubmit={handleAddSubmit}
          >
            {({
              errors,
              handleBlur,
              handleChange,
              submitDisable,
              touched,
              values,
            }) => (
              <>
                <Grid container columnSpacing={3} rowSpacing={2.5}>
                  <Grid item xs={12} md={6}>
                    <TextBox
                      fullWidth
                      label="Company Name"
                      placeholder="Enter your Company Name"
                      name="company_name"
                      value={values.company_name}
                      error={touched.company_name && errors.company_name}
                      helperText={
                        touched.company_name && errors.company_name
                      }
                      onChange={handleChange}
                      onBlur={handleBlur}
                    />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <TextBox
                      fullWidth
                      placeholder="Enter your email"
                      name="email"
                      label="Email"
                      value={values.email}
                      error={touched.email && errors.email}
                      helperText={touched.email && errors.email}
                      onChange={handleChange}
                      onBlur={handleBlur}
                    />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <Box sx={{ width: "100%" }}>
                      <Typography
                        sx={{
                          ml: 1,
                          fontSize: "11px",
                          fontWeight: 500,
                          textTransform: "capitalize",
                        }}
                      >
                        Mobile (optional)
                      </Typography>
                      <MuiTelInput
                        fullWidth
                        placeholder="Enter your mobile number"
                        name="mobile"
                        forceCallingCode
                        disableFormatting
                        defaultCountry="US"
                        value={values.mobile}
                        error={touched.mobile && !!errors.mobile}
                        helperText={touched.mobile && errors.mobile}
                        onChange={(newValue) => {
                          const e: any = {
                            target: { name: "mobile", value: newValue },
                          };
                          handleChange(e);
                        }}
                        onBlur={handleBlur}
                      />
                    </Box>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <TextBox
                      fullWidth
                      placeholder="Enter your website"
                      name="website"
                      label="Website (optional)"
                      value={values.website}
                      onChange={handleChange}
                      onBlur={handleBlur}
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <Box sx={{ width: "100%" }}>
                      <Typography
                        sx={{
                          ml: 1,
                          fontSize: "11px",
                          fontWeight: 600,
                          textTransform: "capitalize",
                          mb: 0.5,
                        }}
                      >
                        Brand Logo (Optional)
                      </Typography>
                      <Box
                        sx={{
                          display: "flex",
                          alignItems: "center",
                          gap: 2,
                        }}
                      >
                        <Box
                          sx={{
                            display: "flex",
                            alignItems: "center",
                            gap: 1,
                            bgcolor:
                              theme.palette.mode === "dark"
                                ? "rgba(255,255,255,0.04)"
                                : "#F8F8F8",
                            borderRadius: "12px",
                            px: 1,
                            flex: 1,
                          }}
                        >
                          <Button
                            variant="rounded"
                            size="small"
                            sx={{
                              display: "flex",
                              alignItems: "center",
                              gap: 0.5,
                              whiteSpace: "nowrap",
                            }}
                            onClick={() => fileRef.current?.click()}
                          >
                            <CloudUploadRounded fontSize="small" />
                            {fileName ? "Change" : "Upload"} File
                          </Button>
                          <Typography
                            sx={{
                              fontSize: "13px",
                              color: theme.palette.text.secondary,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {fileName ?? "No file chosen"}
                          </Typography>
                          <input
                            type="file"
                            ref={fileRef}
                            hidden
                            accept="image/*"
                            onChange={(e: any) =>
                              handleFileChange(e.target.files[0])
                            }
                          />
                        </Box>
                        {image && image !== Dummy.src && (
                          <Box
                            sx={{
                              width: 48,
                              height: 48,
                              borderRadius: "50%",
                              overflow: "hidden",
                              border: `1px solid ${theme.palette.divider}`,
                              flexShrink: 0,
                            }}
                          >
                            <img
                              src={image}
                              alt="preview"
                              crossOrigin="anonymous"
                              style={{
                                width: "100%",
                                height: "100%",
                                objectFit: "cover",
                              }}
                            />
                          </Box>
                        )}
                      </Box>
                    </Box>
                  </Grid>
                </Grid>

                <Box
                  sx={{
                    mt: 3,
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "flex-end",
                    gap: 1.5,
                  }}
                >
                  <Button
                    variant="outlined"
                    onClick={handleAddClose}
                    sx={{
                      borderRadius: "10px",
                      textTransform: "none",
                      fontFamily: "UrbanistMedium",
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="rounded"
                    type="submit"
                    disabled={submitDisable}
                    sx={{ py: 1.5 }}
                  >
                    Add Company
                  </Button>
                </Box>
              </>
            )}
          </FormManager>
        </Box>
      </PopupModal>

      {/* Company Settings Dialog (Manage) */}
      <CompanySettingsDialog
        open={settingsOpen}
        company={selectedCompany}
        onClose={() => {
          setSettingsOpen(false);
          setSelectedCompany(null);
          // Re-fetch companies after changes
          dispatch(CompanyAction(COMPANY_FETCH));
          // Clear the section query param
          if (router.query.section) {
            router.replace("/company", undefined, { shallow: true });
          }
        }}
      />
    </>
  );
};

export default Company;
