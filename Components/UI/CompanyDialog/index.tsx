import { useTheme } from "@mui/material/styles";
import Image from "next/image";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useDispatch, useSelector } from "react-redux";
import * as yup from "yup";

import BusinessIcon from "@/assets/Icons/business-icon.svg";
import DownloadIcon from "@/assets/Icons/download-icon.svg";
import EditPencilIcon from "@/assets/Icons/edit-pencil-icon.svg";
import FormManager from "@/Components/Page/Common/FormManager";
import type { Values } from "@/Components/Page/Common/FormManager/types";
import InputField from "@/Components/UI/AuthLayout/InputFields";
import PanelCard from "@/Components/UI/PanelCard";
import PopupModal from "@/Components/UI/PopupModal";
import useIsMobile from "@/hooks/useIsMobile";
import { CompanyAction } from "@/Redux/Actions";
import { COMPANY_INSERT, COMPANY_UPDATE } from "@/Redux/Actions/CompanyAction";
import { ICompany, rootReducer } from "@/utils/types";
import CheckIcon from "@mui/icons-material/Check";
import CloseIcon from "@mui/icons-material/Close";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import CustomButton from "../Buttons";
import {
  CryptocurrencyDividerLine,
  CryptocurrencyDropdown,
  CryptocurrencyTrigger,
} from "../CryptocurrencySelector/styled";

import {
  Box,
  Grid,
  IconButton,
  InputBase,
  ListItemButton,
  ListItemText,
  Popover,
  Typography,
} from "@mui/material";
import type { ICity, ICountry, IState } from "country-state-city";
import { City, Country, State } from "country-state-city";
import CountryPhoneInput from "../CountryPhoneInput";

export type CompanyDialogMode = "add" | "edit";

// Complete form values type with all fields
type CompanyFormValues = {
  company_name: string;
  email: string;
  mobile: string;
  website: string;
  country: string;
  state: string;
  city: string;
  address_line_1: string;
  address_line_2: string;
  zip_code: string;
  VAT_number: string;
};

type VatOption = {
  code: string;
  label: string;
  taxCode: string;
};

const companyInitial: CompanyFormValues = {
  company_name: "",
  email: "",
  mobile: "",
  website: "",
  country: "",
  state: "",
  city: "",
  address_line_1: "",
  address_line_2: "",
  zip_code: "",
  VAT_number: "",
};

// Component to sync form values to parent state
const ValueSyncer = ({
  values,
  onValuesChange,
}: {
  values: Values;
  onValuesChange: (values: Values) => void;
}) => {
  useEffect(() => {
    onValuesChange(values);
  }, [values, onValuesChange]);
  return null;
};

// Custom hook to manage states and cities based on form values
const useLocationData = (formValues: Values, countries: ICountry[]) => {
  const [states, setStates] = useState<IState[]>([]);
  const [cities, setCities] = useState<ICity[]>([]);
  const prevCountryRef = useRef<string>("");
  const prevStateRef = useRef<string>("");

  useEffect(() => {
    const getCountryByName = (name: string): ICountry | undefined => {
      return countries.find((c) => c.name === name);
    };

    const countryValue = String(formValues.country || "");

    if (countryValue && countryValue !== prevCountryRef.current) {
      const country = getCountryByName(countryValue);
      if (country) {
        setStates(State.getStatesOfCountry(country.isoCode));
        setCities([]);
      }
    } else if (!countryValue) {
      setStates([]);
      setCities([]);
    }

    prevCountryRef.current = countryValue;
  }, [formValues.country, countries]);

  useEffect(() => {
    const getCountryByName = (name: string): ICountry | undefined => {
      return countries.find((c) => c.name === name);
    };

    const stateValue = String(formValues.state || "");
    const countryValue = String(formValues.country || "");

    if (stateValue && countryValue && stateValue !== prevStateRef.current) {
      const country = getCountryByName(countryValue);
      if (country) {
        const statesOfCountry = State.getStatesOfCountry(country.isoCode);
        const state = statesOfCountry.find((s) => s.name === stateValue);
        if (state) {
          setCities(City.getCitiesOfState(country.isoCode, state.isoCode));
        }
      }
    } else if (!stateValue) {
      setCities([]);
    }

    prevStateRef.current = stateValue;
  }, [formValues.state, formValues.country, countries]);

  return { states, cities };
};

export default function CompanyDialog({
  open,
  mode,
  company,
  onClose,
}: {
  open: boolean;
  mode: CompanyDialogMode;
  company?: ICompany | null;
  onClose: () => void;
}) {
  const dispatch = useDispatch();
  const theme = useTheme();
  const { t } = useTranslation("companyDialog");
  const fileRef = useRef<HTMLInputElement>(null);
  const companyState = useSelector(
    (state: rootReducer) => state.companyReducer,
  );
  const isMobile = useIsMobile("sm");

  // Only image-related state (not form data)
  const [mediaFile, setMediaFile] = useState<File | undefined>();
  const [imagePreview, setImagePreview] = useState<string | undefined>();
  const imageObjectUrlRef = useRef<string | null>(null);
  const [formKey, setFormKey] = useState(0);

  // Refs for dropdown triggers
  const triggerRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef<HTMLDivElement>(null);
  const cityRef = useRef<HTMLDivElement>(null);

  // Popover anchor state
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [stateAnchor, setStateAnchor] = useState<HTMLElement | null>(null);
  const [cityAnchor, setCityAnchor] = useState<HTMLElement | null>(null);
  const [vatAnchorEl, setVatAnchorEl] = useState<HTMLElement | null>(null);

  // Refs for selected items in dropdowns
  const selectedItemRef = useRef<HTMLDivElement>(null);
  const selectedStateRef = useRef<HTMLDivElement>(null);
  const selectedCityRef = useRef<HTMLDivElement>(null);
  const selectedVatRef = React.useRef<HTMLDivElement | null>(null);

  // Search term state (UI-only, not form data)
  const [searchTerm, setSearchTerm] = useState("");
  const [stateSearchTerm, setStateSearchTerm] = useState("");
  const [citySearchTerm, setCitySearchTerm] = useState("");

  // Country/State/City data (not form values)
  const [countries, setCountries] = useState<ICountry[]>([]);

  const isOpen = Boolean(anchorEl);

  // Compute initial values
  const initialValues = useMemo<CompanyFormValues>(() => {
    if (mode === "edit" && company) {
      return {
        company_name: company.company_name ?? "",
        email: company.email ?? "",
        mobile: company.mobile ?? "",
        website: company.website ?? "",
        country: company.country ?? "",
        state: company.state ?? "",
        city: company.city ?? "",
        address_line_1: company.address_line_1 ?? "",
        address_line_2: company.address_line_2 ?? "",
        zip_code: company.zip_code ?? "",
        VAT_number: company.VAT_number ?? "",
      };
    }
    return { ...companyInitial };
  }, [mode, company]);

  // Track current form values for useLocationData hook
  const [currentFormValues, setCurrentFormValues] =
    useState<Values>(initialValues);

  // Use custom hook for location data with current form values
  const { states, cities } = useLocationData(currentFormValues, countries);

  // Filtered lists based on search terms
  const filteredCountries = countries.filter((c) =>
    c.name.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const filteredStates = states.filter((s) =>
    s.name.toLowerCase().includes(stateSearchTerm.toLowerCase()),
  );

  const filteredCities = cities.filter((c) =>
    c.name.toLowerCase().includes(citySearchTerm.toLowerCase()),
  );

  // Image preview setup
  useEffect(() => {
    if (!open) return;
    if (imageObjectUrlRef.current) {
      URL.revokeObjectURL(imageObjectUrlRef.current);
      imageObjectUrlRef.current = null;
    }
    if (mode === "edit" && company?.photo) setImagePreview(company.photo);
    if (mode === "add") setImagePreview(undefined);
  }, [open, mode, company]);

  useEffect(() => {
    return () => {
      if (imageObjectUrlRef.current) {
        URL.revokeObjectURL(imageObjectUrlRef.current);
      }
    };
  }, []);

  // Validation schema
  const schema = useMemo(
    () =>
      yup.object().shape({
        company_name: yup
          .string()
          .required(t("validation.companyNameRequired")),
        email: yup
          .string()
          .email(t("validation.emailInvalid"))
          .required(t("validation.emailRequired")),
        mobile: yup
          .string()
          .required(t("validation.mobileRequired"))
          .min(10, t("validation.mobileMin"))
          .max(14, t("validation.mobileMax")),
        website: yup.string().nullable(),
        country: yup.string().nullable(),
        state: yup.string().nullable(),
        city: yup.string().nullable(),
        address_line_1: yup.string().nullable(),
        address_line_2: yup.string().nullable(),
        zip_code: yup.string().nullable(),
        VAT_number: yup.string().nullable(),
      }),
    [t],
  );

  const resetLocal = () => {
    if (imageObjectUrlRef.current) {
      URL.revokeObjectURL(imageObjectUrlRef.current);
      imageObjectUrlRef.current = null;
    }
    setMediaFile(undefined);
    setImagePreview(undefined);
    setSearchTerm("");
    setStateSearchTerm("");
    setCitySearchTerm("");
    setAnchorEl(null);
    setStateAnchor(null);
    setCityAnchor(null);
    setVatAnchorEl(null);
  };

  const handleRequestClose = () => {
    handleClose();
  };

  const handleClose = () => {
    resetLocal();
    setFormKey((prev) => prev + 1);
    onClose();
  };

  const handleFileChange = (file?: File) => {
    if (!file) return;
    if (imageObjectUrlRef.current) {
      URL.revokeObjectURL(imageObjectUrlRef.current);
    }
    const objectUrl = URL.createObjectURL(file);
    imageObjectUrlRef.current = objectUrl;
    setImagePreview(objectUrl);
    setMediaFile(file);
  };

  const handleSubmit = (values: Values) => {
    const formData = new FormData();
    formData.append("data", JSON.stringify(values));
    if (mediaFile) formData.append("image", mediaFile);

    // Uncomment when ready to dispatch
    if (mode === "add") {
      dispatch(CompanyAction(COMPANY_INSERT, formData));
    } else if (company?.company_id) {
      dispatch(
        CompanyAction(COMPANY_UPDATE, { id: company.company_id, formData }),
      );
    }

    handleClose();
  };

  const modeKey = mode === "add" ? "add" : "edit";
  const title = t(`mode.${modeKey}.title`);
  const subtitle = t(`mode.${modeKey}.subtitle`);
  const primaryButton = t(`mode.${modeKey}.primaryButton`);

  // Load countries on mount
  useEffect(() => {
    setCountries(Country.getAllCountries());
  }, []);

  // Sync initial values when they change
  useEffect(() => {
    setCurrentFormValues(initialValues);
  }, [initialValues]);

  const [vatValue, setVatValue] = useState({ code: "AT", taxCode: "VAT" });

  const vatCountries: VatOption[] = [
    // 🇪🇺 EU VAT
    { code: "AT", label: "Austria", taxCode: "VAT" },
    { code: "BE", label: "Belgium", taxCode: "VAT" },
    { code: "BG", label: "Bulgaria", taxCode: "VAT" },
    { code: "CY", label: "Cyprus", taxCode: "VAT" },
    { code: "CZ", label: "Czech Republic", taxCode: "VAT" },
    { code: "DE", label: "Germany", taxCode: "VAT" },
    { code: "DK", label: "Denmark", taxCode: "VAT" },
    { code: "EE", label: "Estonia", taxCode: "VAT" },
    { code: "ES", label: "Spain", taxCode: "VAT" },
    { code: "FI", label: "Finland", taxCode: "VAT" },
    { code: "FR", label: "France", taxCode: "VAT" },
    { code: "GR", label: "Greece", taxCode: "VAT" },
    { code: "HR", label: "Croatia", taxCode: "VAT" },
    { code: "HU", label: "Hungary", taxCode: "VAT" },
    { code: "IE", label: "Ireland", taxCode: "VAT" },
    { code: "IT", label: "Italy", taxCode: "VAT" },
    { code: "LT", label: "Lithuania", taxCode: "VAT" },
    { code: "LU", label: "Luxembourg", taxCode: "VAT" },
    { code: "LV", label: "Latvia", taxCode: "VAT" },
    { code: "MT", label: "Malta", taxCode: "VAT" },
    { code: "NL", label: "Netherlands", taxCode: "VAT" },
    { code: "PL", label: "Poland", taxCode: "VAT" },
    { code: "PT", label: "Portugal", taxCode: "VAT" },
    { code: "RO", label: "Romania", taxCode: "VAT" },
    { code: "SE", label: "Sweden", taxCode: "VAT" },
    { code: "SI", label: "Slovenia", taxCode: "VAT" },
    { code: "SK", label: "Slovakia", taxCode: "VAT" },

    { code: "AD", label: "Andorra", taxCode: "NRT" },
    { code: "AE", label: "United Arab Emirates", taxCode: "TRN" },
    { code: "AF", label: "Afghanistan", taxCode: "TIN" },
    { code: "AL", label: "Albania", taxCode: "TIN" },
    { code: "AR", label: "Argentina", taxCode: "CUIT" },
    { code: "AU", label: "Australia", taxCode: "ABN" },
    { code: "BR", label: "Brazil (Business)", taxCode: "CNPJ" },
    { code: "BR", label: "Brazil (Individual)", taxCode: "CPF" },
    { code: "CA", label: "Canada", taxCode: "BN" },
    { code: "CH", label: "Switzerland", taxCode: "VAT" },
    { code: "CN", label: "China", taxCode: "TIN" },
    { code: "GB", label: "United Kingdom", taxCode: "VAT" },
    { code: "IN", label: "India", taxCode: "GST" },
    { code: "JP", label: "Japan", taxCode: "CN" },
    { code: "MX", label: "Mexico", taxCode: "RFC" },
    { code: "NO", label: "Norway", taxCode: "VAT" },
    { code: "NZ", label: "New Zealand", taxCode: "GST" },
    { code: "SG", label: "Singapore", taxCode: "UEN" },
    { code: "US", label: "United States", taxCode: "EIN" },
    { code: "ZA", label: "South Africa", taxCode: "VAT" },
  ];

  return (
    <PopupModal
      open={open}
      showHeader={false}
      transparent
      handleClose={handleRequestClose}
      sx={{
        "& .MuiDialog-paper": {
          minWidth: isMobile ? "100%" : "456px",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          p: 2,
        },
      }}
    >
      <PanelCard
        title={title}
        subTitle={subtitle}
        showHeaderBorder={false}
        headerPadding={theme.spacing("30px", "30px", 0, "30px")}
        bodyPadding={
          isMobile
            ? theme.spacing("16px", "16px", "16px", "16px")
            : theme.spacing("12px", "30px", "37px", "30px")
        }
        sx={{
          width: "100%",
          borderRadius: "14px",
          maxWidth: "456px",
          mx: "auto",
        }}
        subTitleSx={{
          fontSize: isMobile ? "13px" : "15px",
          fontWeight: 500,
          lineHeight: "18px",
          letterSpacing: 0,
          color: theme.palette.text.secondary,
          fontFamily: "UrbanistMedium",
        }}
        headerAction={
          <IconButton
            onClick={handleRequestClose}
            sx={{
              position: "absolute",
              top: 12,
              right: 12,
              height: 40,
              width: 40,
              padding: "7px",
              backgroundColor: theme.palette.secondary.main,
              border: "1px solid",
              borderColor: theme.palette.border.main,
              borderRadius: "50%",
              "&:hover": {
                backgroundColor: theme.palette.secondary.main,
              },
            }}
          >
            {mode === "add" ? (
              <Image
                src={BusinessIcon.src}
                alt="business-icon"
                width={16}
                height={18}
                draggable={false}
              />
            ) : (
              <Image
                src={EditPencilIcon.src}
                alt="edit-pencil-icon"
                width={16}
                height={18}
                draggable={false}
              />
            )}
          </IconButton>
        }
        headerActionLayout="inline"
      >
        <FormManager
          key={formKey}
          initialValues={initialValues}
          yupSchema={schema}
          onSubmit={handleSubmit}
        >
          {({
            errors,
            handleBlur,
            handleChange,
            handleFieldsChange,
            submitDisable,
            touched,
            values,
          }) => (
            <>
              <ValueSyncer
                values={values}
                onValuesChange={setCurrentFormValues}
              />
              <Grid container rowSpacing={"14px"} columnSpacing={"12px"}>
                <Grid item xs={isMobile ? 12 : 6}>
                  <InputField
                    fullWidth
                    inputHeight={isMobile ? "32px" : "38px"}
                    label={t("fields.companyName.label")}
                    placeholder={t("fields.companyName.placeholder")}
                    name="company_name"
                    value={String(values.company_name || "")}
                    error={Boolean(touched.company_name && errors.company_name)}
                    helperText={
                      touched.company_name && errors.company_name
                        ? String(errors.company_name)
                        : undefined
                    }
                    onChange={handleChange}
                    onBlur={handleBlur}
                    sx={{ gap: "8px" }}
                  />
                </Grid>

                <Grid item xs={isMobile ? 12 : 6}>
                  <InputField
                    fullWidth
                    inputHeight={isMobile ? "32px" : "38px"}
                    label={t("fields.website.label")}
                    placeholder={t("fields.website.placeholder")}
                    name="website"
                    value={String(values.website || "")}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    sx={{ gap: "8px" }}
                  />
                </Grid>

                <Grid item xs={isMobile ? 12 : 6}>
                  <InputField
                    fullWidth
                    inputHeight={isMobile ? "32px" : "38px"}
                    label={t("fields.email.label")}
                    placeholder={t("fields.email.placeholder")}
                    name="email"
                    value={String(values.email || "")}
                    error={Boolean(touched.email && errors.email)}
                    helperText={
                      touched.email && errors.email
                        ? String(errors.email)
                        : undefined
                    }
                    onChange={handleChange}
                    onBlur={handleBlur}
                    sx={{ gap: "8px" }}
                  />
                </Grid>

                <Grid item xs={isMobile ? 12 : 6}>
                  <Typography
                    variant="body2"
                    sx={{
                      fontWeight: 500,
                      fontSize: isMobile ? "13px" : "15px",
                      fontFamily: "UrbanistMedium",
                      textAlign: "start",
                      color: "#242428",
                      lineHeight: "18px",
                      letterSpacing: 0,
                      mb: 1,
                    }}
                  >
                    {t("fields.mobile.label")}
                  </Typography>
                  <CountryPhoneInput
                    fullWidth={true}
                    placeholder={t("mobilePlaceholder")}
                    name="mobile"
                    defaultCountry="US"
                    value={String(values.mobile || "")}
                    inputHeight={isMobile ? "32px" : "38px"}
                    onChange={(newValue) => {
                      handleFieldsChange({ mobile: newValue });
                    }}
                    onBlur={handleBlur}
                  />
                </Grid>

                <Grid item xs={12}>
                  <Box
                    sx={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "8px",
                      height: "64px",
                    }}
                  >
                    <Typography
                      sx={{
                        fontSize: isMobile ? "13px" : "15px",
                        fontWeight: 500,
                        lineHeight: "18px",
                        letterSpacing: 0,
                        color: theme.palette.text.primary,
                        fontFamily: "UrbanistMedium",
                      }}
                    >
                      {t("fields.country.label")}
                    </Typography>

                    <CryptocurrencyTrigger
                      ref={triggerRef}
                      onClick={(e) => {
                        setSearchTerm("");
                        setAnchorEl(e.currentTarget);
                      }}
                      isOpen={isOpen}
                      isMobile={isMobile}
                      fullWidth
                      sx={{
                        borderRadius: "6px",
                        padding: "0 14px",
                        cursor: "text",
                      }}
                    >
                      <Box
                        sx={{ flex: 1, display: "flex", alignItems: "center" }}
                      >
                        <InputBase
                          id="country"
                          fullWidth
                          placeholder="Select Country"
                          value={
                            isOpen ? searchTerm : String(values.country || "")
                          }
                          onChange={(e) => setSearchTerm(e.target.value)}
                          sx={{
                            fontFamily: "UrbanistMedium",
                            fontSize: isMobile ? "13px" : "15px",
                            "& .MuiInputBase-input::placeholder": {
                              fontFamily: "UrbanistMedium",
                              fontSize: isMobile ? "10px" : "13px",
                              letterSpacing: 0,
                              lineHeight: "100%",
                              color: "rgba(189, 189, 189, 1)",
                            },
                          }}
                        />
                      </Box>

                      <Box
                        component="label"
                        htmlFor="country"
                        sx={{
                          display: "flex",
                          alignItems: "center",
                          cursor: "pointer",
                          color: "rgba(103, 103, 104, 1)",
                        }}
                      >
                        <CryptocurrencyDividerLine />
                        {isOpen ? (
                          <ExpandLessIcon
                            sx={{ width: isMobile ? "20px" : "24px" }}
                          />
                        ) : (
                          <ExpandMoreIcon
                            sx={{ width: isMobile ? "20px" : "24px" }}
                          />
                        )}
                      </Box>
                    </CryptocurrencyTrigger>

                    <Popover
                      open={isOpen}
                      anchorEl={anchorEl}
                      onClose={() => {
                        setAnchorEl(null);
                        setSearchTerm("");
                      }}
                      disableAutoFocus
                      disableEnforceFocus
                      anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
                      transformOrigin={{ vertical: "top", horizontal: "left" }}
                      transitionDuration={0}
                      TransitionProps={{
                        onEntering: () => {
                          selectedItemRef.current?.scrollIntoView({
                            block: "center",
                            behavior: "auto",
                          });
                        },
                      }}
                      PaperProps={{
                        sx: {
                          mt: "-1px",
                          borderRadius: "6px",
                          width: triggerRef.current?.offsetWidth,
                          maxHeight: 220,
                          border: "1px solid #E9ECF2",
                          borderTop: "none",
                          boxShadow: "0px 4px 16px 0px rgba(47, 47, 101, 0.15)",
                        },
                      }}
                    >
                      <CryptocurrencyDropdown>
                        {filteredCountries.length > 0 ? (
                          filteredCountries.map((c) => {
                            const isSelected = c.name === values.country;
                            return (
                              <ListItemButton
                                key={c.isoCode}
                                ref={isSelected ? selectedItemRef : null}
                                selected={isSelected}
                                onClick={() => {
                                  // Always clear dependent fields when selecting country
                                  handleFieldsChange({
                                    country: c.name,
                                    state: "",
                                    city: "",
                                  });
                                  setAnchorEl(null);
                                  setSearchTerm("");
                                }}
                                sx={{
                                  p: "8px 14px",
                                  height: isMobile ? "32px" : "40px",
                                  borderRadius: "100px",
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 1.5,
                                }}
                              >
                                <img
                                  width={isMobile ? 16 : 18}
                                  height={isMobile ? 16 : 18}
                                  src={`https://flagcdn.com/w20/${c.isoCode.toLowerCase()}.png`}
                                  alt={c.name}
                                  style={{ borderRadius: "100%" }}
                                />
                                <ListItemText
                                  primary={c.name}
                                  primaryTypographyProps={{
                                    sx: {
                                      fontFamily: "UrbanistMedium",
                                      fontWeight: 500,
                                      fontSize: isMobile ? "13px" : "15px",
                                      lineHeight: "100%",
                                      letterSpacing: 0,
                                    },
                                  }}
                                />
                                {isSelected && (
                                  <CheckIcon
                                    sx={{ ml: "auto", fontSize: 18 }}
                                  />
                                )}
                              </ListItemButton>
                            );
                          })
                        ) : (
                          <Box
                            sx={{
                              p: 2,
                              textAlign: "center",
                              color: "text.secondary",
                            }}
                          >
                            <Typography variant="body2">
                              No results found
                            </Typography>
                          </Box>
                        )}
                      </CryptocurrencyDropdown>
                    </Popover>
                  </Box>
                </Grid>

                <Grid item xs={isMobile ? 12 : 6}>
                  <Box
                    sx={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "8px",
                      height: "64px",
                    }}
                  >
                    <Typography
                      sx={{
                        fontSize: isMobile ? "13px" : "15px",
                        fontWeight: 500,
                        lineHeight: "18px",
                        letterSpacing: 0,
                        color: theme.palette.text.primary,
                        fontFamily: "UrbanistMedium",
                      }}
                    >
                      {t("fields.state.label")}
                    </Typography>

                    <CryptocurrencyTrigger
                      ref={stateRef}
                      onClick={(e) => {
                        if (!values.country) return;
                        setStateSearchTerm("");
                        setStateAnchor(e.currentTarget);
                      }}
                      isOpen={Boolean(stateAnchor)}
                      isMobile={isMobile}
                      fullWidth
                      sx={{
                        borderRadius: "6px",
                        padding: "0 14px",
                        opacity: values.country ? 1 : 0.5,
                        cursor: values.country ? "text" : "not-allowed",
                        pointerEvents: values.country ? "auto" : "none",
                      }}
                    >
                      <Box
                        sx={{ flex: 1, display: "flex", alignItems: "center" }}
                      >
                        <InputBase
                          id="state"
                          fullWidth
                          placeholder="Select State"
                          value={
                            stateAnchor
                              ? stateSearchTerm
                              : String(values.state || "")
                          }
                          onChange={(e) => setStateSearchTerm(e.target.value)}
                          sx={{
                            fontFamily: "UrbanistMedium",
                            fontSize: isMobile ? "13px" : "15px",
                            "& .MuiInputBase-input::placeholder": {
                              opacity: 1,
                              fontFamily: "UrbanistMedium",
                              fontSize: isMobile ? "10px" : "13px",
                              letterSpacing: 0,
                              lineHeight: "100%",
                              color: "rgba(189, 189, 189, 1)",
                            },
                          }}
                        />
                      </Box>

                      <Box
                        component="label"
                        htmlFor="state"
                        sx={{
                          display: "flex",
                          alignItems: "center",
                          cursor: "pointer",
                          color: "rgba(103, 103, 104, 1)",
                        }}
                      >
                        <CryptocurrencyDividerLine />
                        {Boolean(stateAnchor) ? (
                          <ExpandLessIcon
                            sx={{ width: isMobile ? "20px" : "24px" }}
                          />
                        ) : (
                          <ExpandMoreIcon
                            sx={{ width: isMobile ? "20px" : "24px" }}
                          />
                        )}
                      </Box>
                    </CryptocurrencyTrigger>

                    <Popover
                      open={Boolean(stateAnchor)}
                      anchorEl={stateAnchor}
                      onClose={() => {
                        setStateAnchor(null);
                        setStateSearchTerm("");
                      }}
                      disableAutoFocus
                      disableEnforceFocus
                      anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
                      transformOrigin={{ vertical: "top", horizontal: "left" }}
                      transitionDuration={0}
                      TransitionProps={{
                        onEntering: () => {
                          selectedStateRef.current?.scrollIntoView({
                            block: "center",
                            behavior: "auto",
                          });
                        },
                      }}
                      PaperProps={{
                        sx: {
                          mt: "-1px",
                          borderRadius: "6px",
                          width: "fit-content",
                          maxHeight: 220,
                          border: "1px solid #E9ECF2",
                          borderTop: "none",
                          boxShadow: "0px 4px 16px 0px rgba(47, 47, 101, 0.15)",
                        },
                      }}
                    >
                      <CryptocurrencyDropdown>
                        {filteredStates.length > 0 ? (
                          filteredStates.map((s) => {
                            const isSelected = s.name === values.state;

                            return (
                              <ListItemButton
                                key={s.isoCode}
                                ref={isSelected ? selectedStateRef : null}
                                selected={isSelected}
                                onClick={() => {
                                  // Always clear city when selecting state
                                  handleFieldsChange({
                                    state: s.name,
                                    city: "",
                                  });
                                  setStateAnchor(null);
                                  setStateSearchTerm("");
                                }}
                                sx={{
                                  p: "8px 14px",
                                  minHeight: isMobile ? "32px" : "40px",
                                  borderRadius: "100px",
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 1.5,
                                }}
                              >
                                <ListItemText
                                  primary={s.name}
                                  primaryTypographyProps={{
                                    sx: {
                                      fontFamily: "UrbanistMedium",
                                      fontWeight: 500,
                                      fontSize: isMobile ? "13px" : "15px",
                                      lineHeight: "100%",
                                      letterSpacing: 0,
                                      whiteSpace: "nowrap",
                                    },
                                  }}
                                />

                                {isSelected && (
                                  <CheckIcon
                                    sx={{ ml: "auto", fontSize: 18 }}
                                  />
                                )}
                              </ListItemButton>
                            );
                          })
                        ) : (
                          <Box
                            sx={{
                              p: 2,
                              textAlign: "center",
                              color: "text.secondary",
                            }}
                          >
                            <Typography variant="body2">
                              No results found
                            </Typography>
                          </Box>
                        )}
                      </CryptocurrencyDropdown>
                    </Popover>
                  </Box>
                </Grid>

                <Grid item xs={isMobile ? 12 : 6}>
                  <Box
                    sx={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "8px",
                      height: "64px",
                    }}
                  >
                    <Typography
                      sx={{
                        fontSize: isMobile ? "13px" : "15px",
                        fontWeight: 500,
                        lineHeight: "18px",
                        letterSpacing: 0,
                        color: theme.palette.text.primary,
                        fontFamily: "UrbanistMedium",
                      }}
                    >
                      {t("fields.city.label")}
                    </Typography>

                    <CryptocurrencyTrigger
                      ref={cityRef}
                      onClick={(e) => {
                        if (!values.state) return;
                        setCitySearchTerm("");
                        setCityAnchor(e.currentTarget);
                      }}
                      isOpen={Boolean(cityAnchor)}
                      isMobile={isMobile}
                      fullWidth
                      sx={{
                        borderRadius: "6px",
                        padding: "0 14px",
                        opacity: values.state ? 1 : 0.5,
                        cursor: values.state ? "text" : "not-allowed",
                        pointerEvents: values.state ? "auto" : "none",
                      }}
                    >
                      <Box
                        sx={{ flex: 1, display: "flex", alignItems: "center" }}
                      >
                        <InputBase
                          id="city"
                          fullWidth
                          placeholder="Select City"
                          value={
                            cityAnchor
                              ? citySearchTerm
                              : String(values.city || "")
                          }
                          onChange={(e) => setCitySearchTerm(e.target.value)}
                          sx={{
                            fontFamily: "UrbanistMedium",
                            fontSize: isMobile ? "13px" : "15px",
                            "& .MuiInputBase-input::placeholder": {
                              opacity: 1,
                              fontFamily: "UrbanistMedium",
                              fontSize: isMobile ? "10px" : "13px",
                              letterSpacing: 0,
                              lineHeight: "100%",
                              color: "rgba(189, 189, 189, 1)",
                            },
                          }}
                        />
                      </Box>

                      <Box
                        component="label"
                        htmlFor="city"
                        sx={{
                          display: "flex",
                          alignItems: "center",
                          cursor: "pointer",
                          color: "rgba(103, 103, 104, 1)",
                        }}
                      >
                        <CryptocurrencyDividerLine />
                        {Boolean(cityAnchor) ? (
                          <ExpandLessIcon
                            sx={{ width: isMobile ? "20px" : "24px" }}
                          />
                        ) : (
                          <ExpandMoreIcon
                            sx={{ width: isMobile ? "20px" : "24px" }}
                          />
                        )}
                      </Box>
                    </CryptocurrencyTrigger>

                    <Popover
                      open={Boolean(cityAnchor)}
                      anchorEl={cityAnchor}
                      onClose={() => {
                        setCityAnchor(null);
                        setCitySearchTerm("");
                      }}
                      disableAutoFocus
                      disableEnforceFocus
                      anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
                      transformOrigin={{ vertical: "top", horizontal: "left" }}
                      transitionDuration={0}
                      TransitionProps={{
                        onEntering: () => {
                          selectedCityRef.current?.scrollIntoView({
                            block: "center",
                            behavior: "auto",
                          });
                        },
                      }}
                      PaperProps={{
                        sx: {
                          mt: "-1px",
                          borderRadius: "6px",
                          width: "fit-content",
                          maxHeight: 220,
                          border: "1px solid #E9ECF2",
                          borderTop: "none",
                          boxShadow: "0px 4px 16px 0px rgba(47, 47, 101, 0.15)",
                        },
                      }}
                    >
                      <CryptocurrencyDropdown>
                        {filteredCities.length > 0 ? (
                          filteredCities.map((c) => {
                            const isSelected = c.name === values.city;

                            return (
                              <ListItemButton
                                key={c.name}
                                ref={isSelected ? selectedCityRef : null}
                                selected={isSelected}
                                onClick={() => {
                                  handleFieldsChange({ city: c.name });
                                  setCityAnchor(null);
                                  setCitySearchTerm("");
                                }}
                                sx={{
                                  p: "8px 14px",
                                  minHeight: isMobile ? "32px" : "40px",
                                  borderRadius: "100px",
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 1.5,
                                }}
                              >
                                <ListItemText
                                  primary={c.name}
                                  primaryTypographyProps={{
                                    sx: {
                                      fontFamily: "UrbanistMedium",
                                      fontWeight: 500,
                                      fontSize: isMobile ? "13px" : "15px",
                                      lineHeight: "100%",
                                      letterSpacing: 0,
                                      whiteSpace: "nowrap",
                                    },
                                  }}
                                />

                                {isSelected && (
                                  <CheckIcon
                                    sx={{ ml: "auto", fontSize: 18 }}
                                  />
                                )}
                              </ListItemButton>
                            );
                          })
                        ) : (
                          <Box
                            sx={{
                              p: 2,
                              textAlign: "center",
                              color: "text.secondary",
                            }}
                          >
                            <Typography variant="body2">
                              No results found
                            </Typography>
                          </Box>
                        )}
                      </CryptocurrencyDropdown>
                    </Popover>
                  </Box>
                </Grid>

                <Grid item xs={12}>
                  <InputField
                    fullWidth
                    inputHeight={isMobile ? "32px" : "38px"}
                    label={t("fields.addressLine1.label")}
                    placeholder={t("fields.addressLine1.placeholder")}
                    name="address_line_1"
                    value={String(values.address_line_1 || "")}
                    error={Boolean(
                      touched.address_line_1 && errors.address_line_1,
                    )}
                    helperText={
                      touched.address_line_1 && errors.address_line_1
                        ? String(errors.address_line_1)
                        : undefined
                    }
                    onChange={handleChange}
                    onBlur={handleBlur}
                    sx={{ gap: "8px" }}
                  />
                </Grid>

                <Grid item xs={12}>
                  <InputField
                    fullWidth
                    inputHeight={isMobile ? "32px" : "38px"}
                    label={t("fields.addressLine2.label")}
                    placeholder={t("fields.addressLine2.placeholder")}
                    name="address_line_2"
                    value={String(values.address_line_2 || "")}
                    error={Boolean(
                      touched.address_line_2 && errors.address_line_2,
                    )}
                    helperText={
                      touched.address_line_2 && errors.address_line_2
                        ? String(errors.address_line_2)
                        : undefined
                    }
                    onChange={handleChange}
                    onBlur={handleBlur}
                    sx={{ gap: "8px" }}
                  />
                </Grid>

                <Grid item xs={12}>
                  <InputField
                    fullWidth
                    inputHeight={isMobile ? "32px" : "38px"}
                    label={t("fields.zipCode.label")}
                    placeholder={t("fields.zipCode.placeholder")}
                    name="zip_code"
                    value={String(values.zip_code || "")}
                    error={Boolean(touched.zip_code && errors.zip_code)}
                    helperText={
                      touched.zip_code && errors.zip_code
                        ? String(errors.zip_code)
                        : undefined
                    }
                    onChange={handleChange}
                    onBlur={handleBlur}
                    sx={{ gap: "8px" }}
                  />
                </Grid>

                <Grid item xs={12}>
                  <Box
                    sx={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "8px",
                    }}
                  >
                    <Typography
                      sx={{
                        fontSize: isMobile ? "13px" : "15px",
                        fontWeight: 500,
                        lineHeight: "18px",
                        color: theme.palette.text.primary,
                        fontFamily: "UrbanistMedium",
                      }}
                    >
                      {t("vatNumber")}
                    </Typography>

                    <Grid container rowSpacing={"14px"} columnSpacing={"8px"}>
                      {/* Country VAT Dropdown */}
                      <Grid item xs={5}>
                        <Box
                          maxWidth={"150px"}
                          onClick={(e) =>
                            setVatAnchorEl(vatAnchorEl ? null : e.currentTarget)
                          }
                          sx={{
                            cursor: "pointer",
                            border: "1px solid #E9ECF2",
                            borderRadius: "6px",
                            width: "100%",
                            height: isMobile ? "32px" : "40px",
                            padding: isMobile ? "8px" : "10px",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                          }}
                        >
                          <img
                            width={isMobile ? 14 : 20}
                            height={isMobile ? 14 : 20}
                            src={`https://flagcdn.com/w20/${vatValue.code.toLowerCase()}.png`}
                            alt={vatValue.code}
                            style={{ borderRadius: "100%" }}
                          />
                          <Typography
                            sx={{
                              fontSize: isMobile ? "10px" : "13px",
                              fontFamily: "UrbanistMedium",
                              lineHeight: "100%",
                              letterSpacing: 0,
                              fontWeight: 500,
                            }}
                          >
                            {vatValue.code} {vatValue.taxCode}
                          </Typography>

                          <Box
                            sx={{
                              width: "1px",
                              height: "20px",
                              backgroundColor: "#D9D9D9",
                            }}
                          />

                          {vatAnchorEl ? (
                            <ExpandLessIcon
                              sx={{ width: "20px", color: "#676768" }}
                            />
                          ) : (
                            <ExpandMoreIcon
                              sx={{ width: "20px", color: "#676768" }}
                            />
                          )}
                        </Box>

                        <Popover
                          open={Boolean(vatAnchorEl)}
                          anchorEl={vatAnchorEl}
                          onClose={() => setVatAnchorEl(null)}
                          anchorOrigin={{
                            vertical: "bottom",
                            horizontal: "left",
                          }}
                          transformOrigin={{
                            vertical: "top",
                            horizontal: "left",
                          }}
                          transitionDuration={0}
                          TransitionProps={{
                            onEntering: () => {
                              selectedVatRef.current?.scrollIntoView({
                                block: "center",
                                behavior: "auto",
                              });
                            },
                          }}
                          PaperProps={{
                            sx: {
                              width: "170px",
                              height: "220px",
                              padding: "5px",
                              display: "flex",
                              flexDirection: "column",
                              gap: "5px",
                              borderRadius: "6px",
                            },
                          }}
                        >
                          {vatCountries.map((country) => (
                            <Box
                              key={`${country.code}-${country.taxCode}`}
                              ref={
                                country.code === vatValue.code
                                  ? selectedVatRef
                                  : null
                              }
                              onClick={() => {
                                setVatValue({
                                  ...vatValue,
                                  code: country.code,
                                  taxCode: country.taxCode,
                                });
                                setVatAnchorEl(null);
                              }}
                              sx={{
                                display: "flex",
                                justifyContent: "space-between",
                                cursor: "pointer",
                                backgroundColor:
                                  country.code === vatValue.code &&
                                  country.taxCode === vatValue.taxCode
                                    ? "#E5EDFF"
                                    : "",
                                borderRadius: "63px",
                                height: "40px",
                                padding: "10px 14px",
                                alignItems: "center",
                                "&:hover": {
                                  backgroundColor:
                                    country.code === vatValue.code &&
                                    country.taxCode === vatValue.taxCode
                                      ? "#E5EDFF"
                                      : "#F0F4FF",
                                },
                              }}
                            >
                              <Box
                                sx={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: "14px",
                                }}
                              >
                                <img
                                  width={isMobile ? 16 : 20}
                                  height={isMobile ? 16 : 20}
                                  src={`https://flagcdn.com/w20/${country.code.toLowerCase()}.png`}
                                  alt={country.label}
                                  style={{ borderRadius: "100%" }}
                                />
                                <Typography
                                  sx={{
                                    fontSize: "13px",
                                    fontFamily: "UrbanistMedium",
                                    lineHeight: "100%",
                                    letterSpacing: 0,
                                    fontWeight: 500,
                                  }}
                                >
                                  {country.code} {country.taxCode}
                                </Typography>
                              </Box>

                              {country.code === vatValue.code &&
                                country.taxCode === vatValue.taxCode && (
                                  <CheckIcon
                                    sx={{ width: "20px", height: "15px" }}
                                  />
                                )}
                            </Box>
                          ))}
                        </Popover>
                      </Grid>

                      {/* VAT Number Input */}
                      <Grid item xs={7}>
                        <InputField
                          fullWidth
                          placeholder="Enter VAT number"
                          value={values.VAT_number || ""}
                          onChange={(e) =>
                            handleFieldsChange({ VAT_number: e.target.value })
                          }
                          inputHeight={isMobile ? "32px" : "38px"}
                          sx={{ gap: "8px" }}
                        />
                      </Grid>
                    </Grid>
                  </Box>

                  <Box
                    sx={{
                      mt: "8px",
                      display: "flex",
                      justifyContent: "space-between",
                      padding: "8px 12px",
                      backgroundColor: "#DDF5DC",
                      borderRadius: "7px",
                    }}
                  >
                    <Box
                      sx={{ display: "flex", gap: "5px", alignItems: "center" }}
                    >
                      <CheckIcon
                        sx={{ width: "16px", height: "16px", color: "#1B902B" }}
                      />

                      <Typography
                        sx={{
                          fontSize: "12px",
                          color: "#1B902B",
                          fontWeight: 500,
                          fontFamily: "UrbanistMedium",
                          lineHeight: "100%",
                          letterSpacing: 0,
                        }}
                      >
                        {t("vatVerify")}
                      </Typography>
                    </Box>
                    <CloseIcon sx={{ width: "16px", height: "16px" }} />
                  </Box>
                </Grid>

                <Grid item xs={12}>
                  <Typography
                    variant="body2"
                    sx={{
                      fontWeight: 500,
                      fontSize: isMobile ? "13px" : "15px",
                      textAlign: "start",
                      color: "#242428",
                      fontFamily: "UrbanistMedium",
                      lineHeight: "18px",
                      letterSpacing: 0,
                      mb: 1,
                    }}
                  >
                    {t("fields.brandLogo.label")}
                  </Typography>

                  <Box
                    sx={{
                      border: "1px dashed #E9ECF2",
                      borderRadius: "8px",
                      px: 2,
                      py: 2,
                      textAlign: "center",
                      cursor: "pointer",
                      userSelect: "none",
                      backgroundColor: "#FFFFFF",
                      transition: "all 0.2s ease",
                      "&:hover": {
                        borderColor: theme.palette.primary.light,
                        backgroundColor: "#FAFBFF",
                      },
                    }}
                    onClick={() => fileRef.current?.click()}
                  >
                    <input
                      type="file"
                      ref={fileRef}
                      hidden
                      accept="image/*"
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        handleFileChange(file);
                        e.target.value = "";
                      }}
                    />
                    {!imagePreview ? (
                      <>
                        <Box
                          sx={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            width: "fit-content",
                            height: "fit-content",
                            gap: 1,
                            backgroundColor: theme.palette.text.secondary,
                            borderRadius: "6px",
                            padding: "4px",
                            mx: "auto",
                            mb: 1,
                          }}
                        >
                          <Image
                            src={DownloadIcon.src}
                            alt="download-icon"
                            width={12}
                            height={12}
                            draggable={false}
                          />
                        </Box>
                        <Typography
                          sx={{
                            fontSize: 13,
                            color: theme.palette.text.secondary,
                            mb: 0.5,
                            fontWeight: 400,
                          }}
                        >
                          {t("fields.brandLogo.uploadCta")}
                        </Typography>
                        <Typography
                          sx={{
                            fontSize: 12,
                            color: theme.palette.text.secondary,
                            fontWeight: 400,
                          }}
                        >
                          {t("fields.brandLogo.uploadHint")}
                        </Typography>
                      </>
                    ) : (
                      <Box sx={{ mt: 1.5 }}>
                        <Image
                          src={imagePreview}
                          alt="logo preview"
                          crossOrigin="anonymous"
                          width={64}
                          height={64}
                          style={{
                            width: 64,
                            height: 64,
                            borderRadius: 12,
                            objectFit: "cover",
                          }}
                          draggable={false}
                        />
                      </Box>
                    )}
                  </Box>
                </Grid>
              </Grid>

              <Box
                sx={{
                  mt: "10px",
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 1.5,
                }}
              >
                <CustomButton
                  label={t("actions.cancel")}
                  variant="outlined"
                  size="medium"
                  onClick={handleClose}
                  disabled={companyState.loading}
                  sx={{
                    flex: 1,
                    fontSize: "15px",
                    [theme.breakpoints.down("md")]: {
                      fontSize: "13px",
                    },
                  }}
                />
                <CustomButton
                  label={primaryButton}
                  variant="primary"
                  size="medium"
                  onClick={() => handleSubmit(values)}
                  disabled={submitDisable || companyState.loading}
                  sx={{
                    flex: 1,
                    fontSize: "15px",
                    [theme.breakpoints.down("md")]: {
                      fontSize: "13px",
                    },
                  }}
                />
              </Box>
            </>
          )}
        </FormManager>
      </PanelCard>
    </PopupModal>
  );
}
