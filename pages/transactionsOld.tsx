import DataTable from "@/Components/UI/DataTable";
import Panel from "@/Components/UI/Panel";
import TabPanel from "@/Components/UI/TabPanel";
import TextBox from "@/Components/UI/TextBox";
import { a11yProps, stringShorten } from "@/helpers";
import {
  ICustomerTransactions,
  ISelfTransactions,
  pageProps,
  rootReducer,
} from "@/utils/types";
import { CopyAllRounded, Search } from "@mui/icons-material";
import {
  Box,
  IconButton,
  InputAdornment,
  Tab,
  Tabs,
  Typography,
  useTheme,
} from "@mui/material";
import React, { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  TRANSACTION_FETCH,
  TransactionAction,
} from "../Redux/Actions/TransactionAction";
import { TOAST_SHOW } from "@/Redux/Actions/ToastAction";
import CustomTooltip from "@/Components/UI/CustomTooltip";

const selfColumns = [
  "#",
  "id",
  "Payment Mode",
  "Amount",
  "Currency",
  "Transaction Ref.",
  "Type",
  "Status",
  "Date",
];

const customerColumns = [
  "#",
  "id",
  "Customer name",
  "Email",
  "Company name",
  "Payment Mode",
  "Amount",
  "Currency",
  "Transaction Ref.",
  "Type",
  "Status",
  "Date",
];

const Transactions = ({ setPageName }: pageProps) => {
  const theme = useTheme();
  const dispatch = useDispatch();
  const transactionState = useSelector(
    (state: rootReducer) => state.transactionReducer
  );
  const [searchValue, setSearchValue] = useState("");
  const [value, setValue] = useState(0);
  const [selfTransactions, setSelfTransactions] = useState<any[]>([]);
  const [customerTransactions, setCustomerTransactions] = useState<any[]>([]);

  useEffect(() => {
    setPageName("Transactions");
    dispatch(TransactionAction(TRANSACTION_FETCH));
  }, []);

  useEffect(() => {
    if (!transactionState.loading) {
      const tempData1: any = [];
      const tempData2: any = [];
      console.log(transactionState);
      for (let i = 0; i < transactionState.self_transactions.length; i++) {
        const temp = transactionState.self_transactions[i];
        const tempObject = {
          no: i + 1,
          tid: stringShorten(temp.id, 5, 5),
          payment_mode: temp.payment_mode,
          base_amount: temp.base_amount,
          base_currency: temp.base_currency,
          transaction_ref: !temp.transaction_reference ? (
            <Box>No Transaction Ref</Box>
          ) : (
            <CustomTooltip title={temp.transaction_reference}>
              <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
                <Typography fontSize={14} fontWeight={700}>
                  <a
                    href={
                      "https://blockchair.com/search?q=" +
                      temp.transaction_reference
                    }
                    target="_blank"
                  >
                    {stringShorten(temp.transaction_reference, 7, 5)}
                  </a>
                </Typography>
                <IconButton
                  onClick={() => {
                    navigator.clipboard.writeText(
                      "https://blockchair.com/search?q=" +
                        temp.transaction_reference
                    );
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
            </CustomTooltip>
          ),
          hidden: temp.transaction_reference,
          transaction_type: temp.transaction_type,
          status: temp.status,
          date:
            new Date(temp.createdAt).toLocaleDateString() +
            " " +
            new Date(temp.createdAt).toLocaleTimeString(),
        };
        tempData1.push(tempObject);
      }
      for (let i = 0; i < transactionState.customers_transactions.length; i++) {
        const temp = transactionState.customers_transactions[i];
        const tempObject = {
          no: i + 1,
          cid: temp.id ? stringShorten(temp.id, 5, 5) : "No id",
          customer_name: temp.customer_name,
          email: temp.email,
          company_name: temp.company_name,
          payment_mode: temp.payment_mode,
          base_amount: temp.base_amount,
          base_currency: temp.base_currency,
          transaction_ref: !temp.transaction_reference ? (
            <Box>No Transaction Ref</Box>
          ) : (
            <CustomTooltip title={temp.transaction_reference}>
              <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
                <Typography fontSize={14} fontWeight={700}>
                  <a
                    href={
                      "https://blockchair.com/search?q=" +
                      temp.transaction_reference
                    }
                    target="_blank"
                  >
                    {stringShorten(temp.transaction_reference, 7, 5)}
                  </a>
                </Typography>
                <IconButton
                  onClick={() => {
                    navigator.clipboard.writeText(
                      "https://blockchair.com/search?q=" +
                        temp.transaction_reference
                    );
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
            </CustomTooltip>
          ),
          transaction_type: temp.transaction_type,
          status: temp.status,
          date:
            new Date(temp.createdAt).toLocaleDateString() +
            " " +
            new Date(temp.createdAt).toLocaleTimeString(),
        };
        tempData2.push(tempObject);
      }
      setSelfTransactions(tempData1);
      setCustomerTransactions(tempData2);
    }
  }, [transactionState]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchValue(e.target.value);
  };

  return (
    <Box>
      <Box sx={{ m: 2, mb: 5 }}>
        <Box
          sx={{
            my: 2,
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
          <Tabs
            value={value}
            onChange={(e: any, newValue: number) => setValue(newValue)}
            sx={{
              border: 0,
              background: "#f8f8f8",
              width: "fit-content",
              borderRadius: "20px",
              p: 0.5,
              minHeight: 5,
              "& .MuiTabs-indicator": {
                background: theme.palette.secondary.main,
                height: "100%",
                borderRadius: "20px",
                zIndex: "0",
              },
              "& .Mui-selected": {
                color: "#fff !important",
                transition: "0.2s",
              },
            }}
          >
            <Tab
              disableRipple
              label="Customer"
              sx={{
                borderRadius: "20px",
                px: 3,
                py: 1.25,
                minHeight: 5,
                zIndex: 1,
              }}
              {...a11yProps(0)}
            />
            <Tab
              disableRipple
              label="Self"
              sx={{
                borderRadius: "20px",
                px: 3,
                py: 1.25,
                minHeight: 5,
                zIndex: 1,
              }}
              {...a11yProps(0)}
            />
          </Tabs>
        </Box>
        <TabPanel value={value} index={0}>
          <Panel radius={10}>
            <Box>
              <DataTable
                columns={customerColumns}
                data={customerTransactions}
                searchValue={searchValue}
                loading={transactionState.loading}
              />
            </Box>
          </Panel>
        </TabPanel>
        <TabPanel value={value} index={1}>
          <Panel radius={10}>
            <Box>
              <DataTable
                columns={selfColumns}
                data={selfTransactions}
                searchValue={searchValue}
              />
            </Box>
          </Panel>
        </TabPanel>
      </Box>
    </Box>
  );
};

export default Transactions;
