import FormManager from "@/Components/Page/Common/FormManager";
import DataTable from "@/Components/UI/DataTable";
import PopupModal from "@/Components/UI/PopupModal";
import TextBox from "@/Components/UI/TextBox";

import {
  AddCircleOutlineRounded,
  AddRounded,
  CloudUploadRounded,
  DeleteRounded,
  PlusOneRounded,
  Search,
} from "@mui/icons-material";
import {
  Box,
  Button,
  Grid,
  InputAdornment,
  Typography,
  useTheme,
} from "@mui/material";
import { MuiTelInput } from "mui-tel-input";
import Head from "next/head";
import { useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import Dummy from "@/assets/Images/dummy.jpg";
import * as yup from "yup";
import { CompanyAction } from "@/Redux/Actions";
import {
  COMPANY_DELETE,
  COMPANY_FETCH,
  COMPANY_INSERT,
  COMPANY_UPDATE,
} from "@/Redux/Actions/CompanyAction";
import CustomAlert from "@/Components/UI/CustomAlert";
import { pageProps, rootReducer } from "@/utils/types";

const companyInitial = {
  company_name: "",
  email: "",
  mobile: "",
  website: "",
};

const regex: RegExp = new RegExp("^((http|https)://)");

const Company = ({ setPageName }: pageProps) => {
  const dispatch = useDispatch();
  const theme = useTheme();
  const companyState = useSelector(
    (state: rootReducer) => state.companyReducer
  );
  const fileRef = useRef<any>();
  const [mediaFile, setMediaFile] = useState<any>();
  const [fileName, setFileName] = useState<any>();

  const [image, setImage] = useState(Dummy.src);
  const [localData, setLocalData] = useState<any[]>([]);
  const [initialValue, setInitialValue] = useState(
    structuredClone(companyInitial)
  );

  const [searchValue, setSearchValue] = useState("");
  const [open, setOpen] = useState(false);
  const [alertOpen, setAlertOpen] = useState(false);
  const [ID, setID] = useState(0);

  const companySchema = yup.object().shape({
    company_name: yup.string().required("Company Name is required!"),
    email: yup
      .string()
      .email("Please enter a valid email")
      .required("email is required!"),
    mobile: yup
      .string()
      .required("Mobile Number is required!")
      .min(10, "Minimum 10 digits are required!")
      .max(14, "Maximum 14 digits are allowed"),
  });

  useEffect(() => {
    setPageName("Company");
    dispatch(CompanyAction(COMPANY_FETCH));
  }, []);

  useEffect(() => {
    if (companyState?.companyList?.length > 0) {
      const tempArray: any[] = [];
      companyState.companyList.map((x, i) => {
        const tempObj = {
          no: i + 1,
          name: (
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 2,
              }}
            >
              {x.photo ? (
                <img
                  src={x.photo}
                  className="round-img"
                  crossOrigin="anonymous"
                />
              ) : (
                <Box
                  className="round-img"
                  sx={{
                    background: theme.palette.secondary.main + "44",
                    color: "text.secondary",
                    border: "3px solid",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    lineHeight: 0,
                  }}
                >
                  {x.company_name.slice(0, 1)}
                </Box>
              )}
              {x.company_name}
            </Box>
          ),
          hidden: x.company_name,
          email: x.email,
          mobile: x.mobile,
          id: x.company_id,
        };
        tempArray.push({ ...tempObj });
      });
      setLocalData(tempArray);
    }
  }, [companyState.companyList]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchValue(e.target.value);
  };

  const columns = ["#", "Company Name", "Email", "Mobile"];

  const handleFileChange = (file: File) => {
    if (file) {
      setImage(URL.createObjectURL(file));
      setFileName(file.name);
      setMediaFile(file);
    }
  };

  const handleClose = () => {
    setInitialValue(structuredClone(companyInitial));
    setFileName(undefined);
    setMediaFile(undefined);
    setImage(Dummy.src);
    setOpen(false);
    setID(0);
  };

  const handleSubmit = (values: any) => {
    const formData = new FormData();
    if (ID === 0) {
      formData.append("data", JSON.stringify(values));
      formData.append("image", mediaFile);
      dispatch(CompanyAction(COMPANY_INSERT, formData));
    } else {
      formData.append("data", JSON.stringify(values));
      formData.append("image", mediaFile);
      dispatch(CompanyAction(COMPANY_UPDATE, { id: ID, formData }));
    }
    setInitialValue(structuredClone(companyInitial));
    setFileName(undefined);
    setMediaFile(undefined);
    setImage(Dummy.src);
    setOpen(false);
  };

  const handleDelete = () => {
    dispatch(CompanyAction(COMPANY_DELETE, { id: ID }));
    setID(0);
    setAlertOpen(false);
  };

  return (
    <>
      <Head>
        <title>BozzWallet</title>
        <meta name="description" content="Generated by create next app" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <CustomAlert
        open={alertOpen}
        handleClose={() => {
          setAlertOpen(false);
          setID(0);
        }}
        message={
          "you want to remove this company? as it will remove all the users, transactions and API keys."
        }
        confirmText="Delete"
        onConfirm={handleDelete}
      />
      <Box sx={{ m: 2, mb: 5 }}>
        <Box
          sx={{
            mt: 2,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <TextBox
            customWidth="auto"
            placeholder="Search"
            value={searchValue}
            onChange={handleSearchChange}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search />
                </InputAdornment>
              ),
            }}
          />
          <Button
            variant="rounded"
            sx={{ display: "flex", alignItems: "center" }}
            onClick={() => setOpen(true)}
          >
            <AddCircleOutlineRounded fontSize="small" sx={{ mr: 0.5 }} />
            Add New
          </Button>
        </Box>
        <Box>
          <DataTable
            columns={columns}
            data={localData}
            hasAction
            searchValue={searchValue}
            actionColumn={(index) => (
              <Box
                sx={{
                  "& button": {
                    mr: 1,
                  },
                }}
              >
                <Button
                  variant="pills"
                  onClick={() => {
                    const id = localData[index].id;
                    setID(id);
                    const singleCompany = companyState.companyList[index];
                    if (singleCompany) {
                      setInitialValue({
                        company_name: singleCompany.company_name,
                        email: singleCompany.email,
                        mobile: singleCompany.mobile,
                        website: singleCompany.website,
                      });
                      setImage(singleCompany.photo);
                      setOpen(true);
                    }
                  }}
                >
                  Edit
                </Button>
                <Button
                  variant="outlined"
                  color="error"
                  disableRipple={false}
                  sx={{ borderRadius: "20px" }}
                  onClick={() => {
                    const id = localData[index].id;
                    setID(id);
                    setAlertOpen(true);
                  }}
                >
                  <DeleteRounded />
                </Button>
              </Box>
            )}
          />
        </Box>
      </Box>
      <PopupModal
        open={open}
        showClose
        headerText={`${ID === 0 ? "Add" : "Update"} Company`}
        handleClose={handleClose}
      >
        <Box sx={{ minWidth: "800px" }}>
          <FormManager
            initialValues={initialValue}
            yupSchema={companySchema}
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
                <Grid container columnSpacing={3}>
                  <Grid item md={6}>
                    <Box
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexDirection: "column",
                        rowGap: "20px",
                        width: "100%",
                      }}
                    >
                      <TextBox
                        fullWidth={true}
                        label={"Company Name"}
                        placeholder="Enter your Company Name"
                        name="company_name"
                        value={values.company_name}
                        error={touched.company_name && errors.company_name}
                        helperText={
                          touched.company_name &&
                          errors.company_name &&
                          errors.company_name
                        }
                        onChange={handleChange}
                        onBlur={handleBlur}
                      />

                      <TextBox
                        fullWidth={true}
                        placeholder="Enter your email"
                        name="email"
                        label={"Email"}
                        value={values.email}
                        error={touched.email && errors.email}
                        helperText={
                          touched.email && errors.email && errors.email
                        }
                        onChange={handleChange}
                        onBlur={handleBlur}
                      />
                      <Box sx={{ width: "100%" }}>
                        <Typography
                          sx={{
                            ml: 1,
                            fontSize: "11px",
                            fontWeight: 500,
                            textTransform: "capitalize",
                          }}
                        >
                          Mobile
                        </Typography>
                        <MuiTelInput
                          fullWidth={true}
                          placeholder="Enter your mobile number"
                          name="mobile"
                          forceCallingCode
                          disableFormatting
                          defaultCountry="US"
                          value={values.mobile}
                          error={touched.mobile && errors.mobile}
                          helperText={
                            touched.mobile && errors.mobile && errors.mobile
                          }
                          onChange={(newValue, info) => {
                            console.log(newValue, info);
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
                    </Box>
                  </Grid>
                  <Grid item md={6}>
                    <Box
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexDirection: "column",
                        rowGap: "20px",
                        width: "100%",
                      }}
                    >
                      <TextBox
                        fullWidth={true}
                        placeholder="Enter your website"
                        name="website"
                        label={"Website (optional)"}
                        value={values.website}
                        onChange={handleChange}
                        onBlur={handleBlur}
                      />
                      <Box sx={{ width: "100%" }}>
                        <Typography
                          sx={{
                            ml: 1,
                            fontSize: "11px",
                            fontWeight: 600,
                            textTransform: "capitalize",
                          }}
                        >
                          Brand Logo (Optional)
                        </Typography>
                        <Box
                          sx={{
                            mt: 0.5,
                            background: "#F8F8F8",
                            borderRadius: "20px",
                            display: "flex",
                            alignItems: "center",
                            gap: 1,
                          }}
                        >
                          <Button
                            variant="rounded"
                            sx={{
                              display: "flex",
                              alignItems: "center",
                              gap: 1,
                            }}
                            onClick={() => {
                              fileRef.current.click();
                            }}
                          >
                            <CloudUploadRounded fontSize="small" />
                            {fileName ? "Change" : "Upload"} File
                          </Button>
                          <Typography>
                            {fileName ?? "No file chosen"}
                          </Typography>
                          <input
                            type="file"
                            ref={fileRef}
                            hidden
                            onChange={(e: any) =>
                              handleFileChange(e.target.files[0])
                            }
                          />
                        </Box>
                      </Box>
                      <Box sx={{ width: "100%" }}>
                        <Box
                          sx={{
                            display: "flex",
                            alignItems: "center",
                            gap: 3,
                            "& img": {
                              width: "100px",
                              height: "100px",
                              objectFit: "cover",
                              objectPosition: "center",
                              borderRadius: "100%",
                              boxShadow: "0 0 3px #000",
                            },
                          }}
                        >
                          <Typography
                            sx={{
                              ml: 1,
                              fontSize: "11px",
                              fontWeight: 600,
                              textTransform: "capitalize",
                            }}
                          >
                            Logo Preview
                          </Typography>
                          <img
                            src={image}
                            alt="no picture"
                            crossOrigin="anonymous"
                          />
                        </Box>
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
                  }}
                >
                  <Button
                    variant="rounded"
                    type="submit"
                    disabled={submitDisable}
                    sx={{ py: 1.5 }}
                  >
                    {ID === 0 ? "Add" : "Update"}
                  </Button>
                </Box>
              </>
            )}
          </FormManager>
        </Box>
      </PopupModal>
    </>
  );
};

export default Company;
