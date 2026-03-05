import CameraIcon from "@/assets/Icons/camera-icon.svg";
import TrashIcon from "@/assets/Icons/trash-icon.svg";
import InputField from "@/Components/UI/AuthLayout/InputFields";
import CustomButton from "@/Components/UI/Buttons";
import CountryPhoneInput from "@/Components/UI/CountryPhoneInput";
import PanelCard from "@/Components/UI/PanelCard";
import { getInitials } from "@/helpers";
import useIsMobile from "@/hooks/useIsMobile";
import { UserAction } from "@/Redux/Actions";
import { USER_UPDATE } from "@/Redux/Actions/UserAction";
import { TokenData } from "@/utils/types";
import { AccountBox } from "@mui/icons-material";
import { Box, Grid, IconButton, Typography } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import Image from "next/image";
import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useDispatch } from "react-redux";
import * as yup from "yup";
import FormManager from "../Common/FormManager";

const initialValue = {
  firstName: "",
  lastName: "",
  email: "",
  mobile: "",
};

const AccountSetting = ({ tokenData }: { tokenData: TokenData }) => {
  const dispatch = useDispatch();
  const theme = useTheme();
  const { t } = useTranslation("profile");

  const fileRef = useRef<any>();
  const isMobile = useIsMobile("md");
  const [media, setMedia] = useState<any>();
  const [initialUser, setInitialUser] = useState({ ...initialValue });
  const [initialPhoto, setInitialPhoto] = useState("");
  const [userPhoto, setUserPhoto] = useState("");
  const [imageError, setImageError] = useState(false);

  const registerSchema = yup.object().shape({
    firstName: yup.string().required(t("firstNameRequired")),
    lastName: yup.string().required(t("lastNameRequired")),
    email: yup.string().email(t("emailInvalid")).required(t("emailRequired")),
  });

  useEffect(() => {
    const name = tokenData.name.split(" ");
    setInitialUser({
      firstName: name[0],
      lastName: name[1],
      email: tokenData.email,
      mobile: tokenData.mobile,
    });
    setUserPhoto(tokenData.photo);
    setInitialPhoto(tokenData.photo);
    setImageError(false);
  }, [tokenData]);

  const hasChanges = (values: any) => {
    const hasFormChanges =
      values.firstName !== initialUser.firstName ||
      values.lastName !== initialUser.lastName ||
      values.email !== initialUser.email ||
      values.mobile !== initialUser.mobile;

    // Check if photo has changed (uploaded new photo or removed existing one)
    const hasPhotoChanges =
      (media !== undefined && media !== null) || // New photo uploaded
      userPhoto !== initialPhoto; // Photo changed or removed

    return hasFormChanges || hasPhotoChanges;
  };

  const handleSubmit = (values: any) => {
    const { firstName, lastName, email, mobile } = values;
    const finalPayload = {
      name: firstName + " " + lastName,
      email,
      mobile,
    };
    const formData = new FormData();
    if (media) {
      formData.append("image", media);
    }
    formData.append("data", JSON.stringify({ ...finalPayload }));
    dispatch(UserAction(USER_UPDATE, formData));
    // Reset initial values after successful update
    setInitialUser({
      firstName,
      lastName,
      email,
      mobile,
    });
    setInitialPhoto(userPhoto);
    setMedia(undefined);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const file = e.target.files[0];
      setUserPhoto(URL.createObjectURL(file));
      setMedia(file);
      setImageError(false);
    }
  };

  const handleRemovePhoto = () => {
    setUserPhoto("");
    setMedia(null);
    setImageError(false);
    if (fileRef.current) {
      fileRef.current.value = "";
    }
  };

  return (
    <PanelCard
      bodyPadding={
        isMobile
          ? `${theme.spacing("12px", 2, 2, 2)}`
          : `${theme.spacing(2, 2.5, 2.5, 2.5)}`
      }
      title={t("accountSetting")}
      showHeaderBorder={false}
      headerAction={
        <IconButton>
          <AccountBox
            color="action"
            style={{ height: "16px", width: "16px" }}
          />
        </IconButton>
      }
    >
      <Box>
        {/* Avatar */}
        <Box
          sx={{
            mx: "auto",
            border: "1px solid",
            position: "relative",
            width: 70,
            height: 70,
            borderRadius: "50%",
            overflow: "hidden",
            borderColor: "divider",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor:
              userPhoto && !imageError
                ? "transparent"
                : theme.palette.primary.light,
          }}
        >
          {userPhoto && !imageError ? (
            <Image
              src={userPhoto}
              alt={t("profilePhotoAlt")}
              fill
              style={{ objectFit: "cover", borderRadius: "50%" }}
              draggable={false}
              onError={() => setImageError(true)}
            />
          ) : (
            <Typography
              sx={{
                fontSize: isMobile ? "20px" : "24px",
                fontWeight: 600,
                color: theme.palette.primary.main,
                backgroundColor: theme.palette.primary.light,
                fontFamily: "UrbanistMedium",
                textTransform: "uppercase",
              }}
            >
              {getInitials(initialUser.firstName, initialUser.lastName)}
            </Typography>
          )}
        </Box>

        {/* Actions */}
        <Box mt={isMobile ? "10px" : "4px"}>
          <Box
            sx={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              gap: { xs: "12px", sm: "12px", md: "21px", lg: "21px" },
              // flexWrap: "wrap",
            }}
          >
            <Box
              sx={{
                order: { xs: 2, lg: 1 },
                flex: { xs: "1 1 calc(50% - 4px)", sm: "0 0 auto" },
                display: "flex",
                justifyContent: "center",
                minWidth: { xs: "calc(50% - 4px)", sm: "auto" },
              }}
            >
              <CustomButton
                label={t("uploadNewPhoto")}
                variant="outlined"
                size={isMobile ? "small" : "medium"}
                startIcon={
                  <Image
                    src={CameraIcon.src}
                    alt="camera-icon"
                    width={14}
                    height={12}
                    draggable={false}
                  />
                }
                iconSize={18}
                onClick={() => fileRef.current?.click()}
                sx={{
                  width: { xs: "100%", sm: "auto" },
                  padding: { xs: "0px 10px", md: "0px 16px" },
                  fontSize: { xs: "13px", sm: "15px" },
                }}
              />
            </Box>
            <Box
              sx={{
                order: { xs: 1, lg: 2 },
                flex: { xs: "1 1 calc(50% - 4px)", sm: "0 0 auto" },
                display: "flex",
                justifyContent: "center",
                minWidth: { xs: "calc(50% - 4px)", sm: "auto" },
              }}
            >
              <CustomButton
                label={t("remove")}
                variant="outlined"
                size={isMobile ? "small" : "medium"}
                startIcon={
                  <Image
                    src={TrashIcon.src}
                    alt="trash-icon"
                    width={12}
                    height={12}
                    draggable={false}
                  />
                }
                iconSize={18}
                onClick={handleRemovePhoto}
                sx={{
                  color: "#676768",
                  width: { xs: "100%", sm: "auto", md: "auto" },
                  padding: { xs: "0px 16px", sm: "0px 49px", md: "0px 49px" },
                  fontSize: { xs: "13px", sm: "15px", md: "15px" },
                }}
              />
            </Box>
          </Box>
        </Box>

        {/* Hidden file input */}
        <input
          type="file"
          accept="image/*"
          hidden
          ref={fileRef}
          onChange={handleFileChange}
        />
      </Box>
      <FormManager
        initialValues={initialUser}
        yupSchema={registerSchema}
        onSubmit={handleSubmit}
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
            <Box
              sx={{
                display: "flex",
                flexDirection: "column",
                rowGap: isMobile ? "12px" : "14px",
                width: "100%",
                mt: isMobile ? "16px" : "14px",
              }}
            >
              <Grid container columnSpacing={2} rowSpacing={0}>
                <Grid item xs={12} sm={6}>
                  <InputField
                    fullWidth={true}
                    inputHeight={isMobile ? "32px" : "38px"}
                    label={t("firstName")}
                    placeholder={t("firstNamePlaceholder")}
                    value={values.firstName}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                      const event = {
                        target: {
                          name: "firstName",
                          value: e.target.value,
                        },
                      } as React.ChangeEvent<HTMLInputElement>;

                      handleChange(event);
                    }}
                    onBlur={handleBlur}
                    name="firstName"
                    error={touched.firstName && errors.firstName}
                    helperText={
                      touched.firstName && errors.firstName && errors.firstName
                    }
                    sx={{ ap: isMobile ? "6px" : "8px" }}
                  />
                </Grid>
                <Grid
                  item
                  xs={12}
                  sm={6}
                  sx={{ marginTop: { xs: "12px", sm: "0px" } }}
                >
                  <InputField
                    fullWidth={true}
                    inputHeight={isMobile ? "32px" : "38px"}
                    label={t("lastName")}
                    placeholder={t("lastNamePlaceholder")}
                    name="lastName"
                    value={values.lastName}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                      const event = {
                        target: {
                          name: "lastName",
                          value: e.target.value,
                        },
                      } as React.ChangeEvent<HTMLInputElement>;

                      handleChange(event);
                    }}
                    onBlur={handleBlur}
                    error={touched.lastName && errors.lastName}
                    helperText={
                      touched.lastName && errors.lastName && errors.lastName
                    }
                    sx={{
                      gap: isMobile ? "6px" : "8px",
                    }}
                  />
                </Grid>
              </Grid>

              <Grid container columnSpacing={2} rowSpacing={0}>
                <Grid item xs={12} sm={6}>
                  <InputField
                    fullWidth={true}
                    inputHeight={isMobile ? "32px" : "38px"}
                    label={t("email")}
                    placeholder={t("emailPlaceholder")}
                    name="email"
                    value={values.email}
                    error={touched.email && errors.email}
                    helperText={touched.email && errors.email && errors.email}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                      const event = {
                        target: {
                          name: "email",
                          value: e.target.value,
                        },
                      } as React.ChangeEvent<HTMLInputElement>;

                      handleChange(event);
                    }}
                    onBlur={handleBlur}
                    sx={{ ap: isMobile ? "6px" : "8px" }}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Box
                    sx={{
                      width: "100%",
                      display: "flex",
                      flexDirection: "column",
                      gap: "8px",
                      marginTop: { xs: "12px", sm: "0px" },
                    }}
                  >
                    <Typography
                      variant="body2"
                      sx={{
                        fontWeight: 500,
                        fontSize: isMobile ? "13px" : "15px",
                        fontFamily: "UrbanistMedium",
                        textAlign: "start",
                        color: theme.palette.text.primary,
                        letterSpacing: 0,
                        lineHeight: "100%",
                      }}
                    >
                      {t("mobile")}
                    </Typography>
                    <CountryPhoneInput
                      fullWidth={true}
                      placeholder={t("mobilePlaceholder")}
                      name="mobile"
                      defaultCountry="US"
                      value={values.mobile}
                      inputHeight={"38px"}
                      onChange={(newValue) => {
                        const e: any = {
                          target: {
                            name: "mobile",
                            value: newValue,
                          },
                        };
                        handleChange(e);
                      }}
                      onBlur={handleBlur}
                    />
                  </Box>
                </Grid>
              </Grid>

              <Box
                sx={{
                  display: "flex",
                  justifyContent: { xs: "stretch", sm: "flex-end" },
                  gap: "10px",
                  mt: "4px",
                  width: "100%",
                }}
              >
                <CustomButton
                  variant="primary"
                  size={isMobile ? "small" : "medium"}
                  type="submit"
                  disabled={submitDisable || !hasChanges(values)}
                  label={t("update")}
                  sx={{ width: { xs: "100%", sm: "auto" } }}
                />
              </Box>
            </Box>
          </>
        )}
      </FormManager>
    </PanelCard>
  );
};

export default AccountSetting;
