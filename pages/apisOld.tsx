import FormManager from "@/Components/Page/Common/FormManager";
import CustomAlert from "@/Components/UI/CustomAlert";
import DataTable from "@/Components/UI/DataTable";
import Dropdown from "@/Components/UI/Dropdown";
import PopupModal from "@/Components/UI/PopupModal";
import TextBox from "@/Components/UI/TextBox";
import { ApiAction, CompanyAction } from "@/Redux/Actions";
import { API_DELETE, API_FETCH, API_INSERT } from "@/Redux/Actions/ApiAction";
import { COMPANY_FETCH } from "@/Redux/Actions/CompanyAction";
import { menuItem, pageProps, rootReducer } from "@/utils/types";
import {
  AddCircleOutlineRounded,
  CopyAllRounded,
  DeleteRounded,
  Search,
  CloseRounded,
} from "@mui/icons-material";
import {
  Box,
  Button,
  Grid,
  IconButton,
  InputAdornment,
  Typography,
  useTheme,
} from "@mui/material";

import Head from "next/head";
import { useRouter } from "next/router";
import React, { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import * as yup from "yup";
import { TOAST_SHOW } from "../Redux/Actions/ToastAction";
import { stringShorten } from "@/helpers";

const companyInitial = {
  company_id: 0,
  base_currency: "USD",
  withdrawal_whitelist: false,
};

const base_currency = [
  { label: "USD", value: "USD" },
  { label: "NGN", value: "NGN" },
];

const APIs = ({ setPageName }: pageProps) => {
  const dispatch = useDispatch();
  const router = useRouter();

  const companyList = useSelector(
    (state: rootReducer) => state.companyReducer.companyList
  );

  const apiState = useSelector((state: rootReducer) => state.apiReducer);

  const [localData, setLocalData] = useState<any[]>([]);
  const [menuItem, setMenuItem] = useState<menuItem[]>([]);
  const [initialValue, setInitialValue] = useState(
    structuredClone(companyInitial)
  );

  const [searchValue, setSearchValue] = useState("");
  const [open, setOpen] = useState(false);
  const [withdrawalWhitelist, setWithdrawalWhitelist] = useState(false);
  const [alertOpen, setAlertOpen] = useState(false);
  const [ID, setID] = useState(0);

  const apiSchema = yup.object().shape({
    company_id: yup
      .string()
      .test(
        "company_id",
        "please select a company",
        (value: any) => value != 0
      ),
  });

  useEffect(() => {
    setPageName("API's");
    dispatch(CompanyAction(COMPANY_FETCH));
    dispatch(ApiAction(API_FETCH));
  }, []);

  useEffect(() => {
    if (companyList.length > 0) {
      const tempList: menuItem[] = [];
      for (let i = 0; i < companyList.length; i++) {
        tempList.push({
          label: companyList[i].company_name,
          value: companyList[i].company_id,
        });
      }
      setMenuItem([{ label: "Select Company", value: 0 }, ...tempList]);
    }
  }, [companyList]);

  useEffect(() => {
    if (apiState.apiList.length > 0) {
      const apiList = apiState.apiList;
      const tempData = [];
      for (let i = 0; i < apiList.length; i++) {
        const tempObject = {
          no: i + 1,
          company_name: apiList[i].company_name,
          base_currency: apiList[i].base_currency,
          id: apiList[i].api_id,
          api: (
            <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
              <Typography fontSize={14} fontWeight={700}>
                {stringShorten(apiList[i].apiKey)}
              </Typography>
              <IconButton
                onClick={() => {
                  navigator.clipboard.writeText(apiList[i].apiKey);
                  dispatch({
                    type: TOAST_SHOW,
                    payload: {
                      message: "Copied!",
                      severity: "info",
                    },
                  });
                }}
              >
                <CopyAllRounded fontSize="small" color="secondary" />
              </IconButton>
            </Box>
          ),
          token: (
            <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
              <Typography fontSize={14} fontWeight={700}>
                {stringShorten(apiList[i].adminToken)}
              </Typography>
              <IconButton
                onClick={() => {
                  navigator.clipboard.writeText(apiList[i].adminToken);
                  dispatch({
                    type: TOAST_SHOW,
                    payload: {
                      message: "Copied!",
                      severity: "info",
                    },
                  });
                }}
              >
                <CopyAllRounded fontSize="small" color="secondary" />
              </IconButton>
            </Box>
          ),
        };
        tempData.push(tempObject);
      }
      setLocalData(tempData);
    }
  }, [apiState.apiList]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchValue(e.target.value);
  };

  const columns = ["#", "Company Name", "Base Currency", "API", "Admin Token"];

  const handleClose = () => {
    setInitialValue(structuredClone(companyInitial));
    setOpen(false);
    setID(0);
  };

  const handleSubmit = (values: any) => {
    console.log("Withdrawal Whitelist enabled:", values.withdrawal_whitelist);
    
    // Include withdrawal whitelist in the payload
    const payload = {
      ...values,
      withdrawal_whitelist: values.withdrawal_whitelist
    };
    
    dispatch(ApiAction(API_INSERT, payload));
    setOpen(false);
    setWithdrawalWhitelist(false); // Reset the toggle state
  };

  const handleDelete = () => {
    dispatch(ApiAction(API_DELETE, { id: ID }));
    handleClose();
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
        headerText={"Generate API key"}
        handleClose={handleClose}
      >
        <Box sx={{ minWidth: "400px" }}>
          <FormManager
            initialValues={initialValue}
            yupSchema={apiSchema}
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
                    justifyContent: "center",
                    flexDirection: "column",
                    width: "100%",
                  }}
                >
                  <Dropdown
                    fullWidth={true}
                    label={"Company Name"}
                    menuItems={menuItem}
                    value={values.company_id}
                    error={touched.company_id && errors.company_id}
                    helperText={
                      touched.company_id &&
                      errors.company_id &&
                      errors.company_id
                    }
                    getValue={(value: any) => {
                      const e: any = {
                        target: {
                          name: "company_id",
                          value,
                        },
                      };
                      handleChange(e);
                    }}
                    onBlur={handleBlur}
                  />
                  <Box sx={{ width: "100%", mt: 3 }}>
                    <Dropdown
                      fullWidth={true}
                      label={"Base Currency"}
                      menuItems={base_currency}
                      value={values.base_currency}
                      error={touched.base_currency && errors.base_currency}
                      helperText={
                        touched.base_currency &&
                        errors.base_currency &&
                        errors.base_currency
                      }
                      getValue={(value: any) => {
                        const e: any = {
                          target: {
                            name: "base_currency",
                            value,
                          },
                        };
                        handleChange(e);
                      }}
                      onBlur={handleBlur}
                    />
                  </Box>
                  
                  <Box sx={{ width: "100%", mt: 3, p: 2.5, border: "1px solid", borderColor: "divider", borderRadius: 2, bgcolor: "background.paper" }}>
                    <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
                      Withdrawal Whitelist
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Once this function is enabled, your account will only be able to withdraw to addresses on your whitelist.
                    </Typography>
                    <Typography
                      variant="body2"
                      sx={{ mt: 1.5, fontWeight: 600, color: "warning.main", cursor: "pointer", width: "fit-content" }}
                      onClick={() => router.push("/walletAddress")}
                    >
                      Address Management
                    </Typography>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 2, mt: 3 }}>
                      <Button
                        variant={values.withdrawal_whitelist ? "outlined" : "contained"}
                        color={values.withdrawal_whitelist ? "inherit" : "error"}
                        startIcon={<CloseRounded />}
                        onClick={() => {
                          const eOff: any = { target: { name: "withdrawal_whitelist", value: false } };
                          handleChange(eOff);
                          setWithdrawalWhitelist(false);
                        }}
                        sx={{ borderRadius: 2, px: 3, py: "10px" }}
                      >
                        OFF
                      </Button>
                      <Button
                        variant={values.withdrawal_whitelist ? "contained" : "outlined"}
                        color="primary"
                        onClick={() => {
                          const eOn: any = { target: { name: "withdrawal_whitelist", value: true } };
                          handleChange(eOn);
                          setWithdrawalWhitelist(true);
                        }}
                        sx={{ borderRadius: 2, px: 4, py: "13px", fontWeight: 700 }}
                      >
                        Enable
                      </Button>
                    </Box>
                  </Box>
                </Box>

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
                    Generate
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

export default APIs;
