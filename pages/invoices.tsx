import React, { useCallback, useEffect, useMemo, useState } from "react";
import Head from "next/head";
import {
  Box,
  Typography,
  Tab,
  Tabs,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  IconButton,
  Skeleton,
  Select,
  MenuItem,
  FormControl,
  useTheme,
  Tooltip,
} from "@mui/material";
import {
  DownloadRounded,
  PrintRounded,
  FileDownloadRounded,
  ReceiptLongRounded,
  AssessmentRounded,
} from "@mui/icons-material";
import { useTranslation } from "react-i18next";
import { pageProps } from "@/utils/types";
import useIsMobile from "@/hooks/useIsMobile";
import axiosBaseApi from "@/axiosConfig";
import CustomButton from "@/Components/UI/Buttons";
import PanelCard from "@/Components/UI/PanelCard";
import { theme as appTheme } from "@/styles/theme";
import { getCurrencySymbol } from "@/helpers";
import { useSelector } from "react-redux";

interface Invoice {
  invoice_id: number;
  invoice_number: string;
  transaction_id: number;
  company_id: number;
  customer_name: string;
  description: string;
  unit_price: number;
  vat_rate: number;
  vat_amount: number;
  total_usd: number;
  crypto_currency: string;
  invoice_date: string;
  created_at: string;
}

interface TaxReportData {
  summary: {
    total_revenue: number;
    total_tax: number;
    total_invoices: number;
    group_by: string;
  };
  by_period: Array<{
    period: string;
    period_label: string;
    revenue: number;
    tax_collected: number;
    invoice_count: number;
  }>;
  by_jurisdiction: Array<{
    country: string;
    tax_rate: number;
    revenue: number;
    tax_collected: number;
    invoice_count: number;
  }>;
}

const InvoicesPage = ({ setPageName, setPageDescription }: pageProps) => {
  const muiTheme = useTheme();
  const isMobile = useIsMobile("md");
  const { t } = useTranslation("common");

  const [activeTab, setActiveTab] = useState(0);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [invoiceLoading, setInvoiceLoading] = useState(true);
  const [totalInvoices, setTotalInvoices] = useState(0);
  const [page, setPage] = useState(1);

  const [taxReport, setTaxReport] = useState<TaxReportData | null>(null);
  const [taxLoading, setTaxLoading] = useState(false);
  const [groupBy, setGroupBy] = useState<string>("month");
  const [taxPeriod, setTaxPeriod] = useState<string>("all");

  // Get company's base currency from API state
  const apiState = useSelector((state: any) => state?.api);
  const baseCurrency = apiState?.apiData?.[0]?.base_currency || "USD";

  const selectedCompanyId = useSelector(
    (state: any) => state?.companyReducer?.selectedCompanyId
  );

  useEffect(() => {
    if (setPageName && setPageDescription) {
      setPageName("Invoices & Tax");
      setPageDescription("View invoices and tax reports");
    }
  }, [setPageName, setPageDescription]);

  // Fetch invoices
  const fetchInvoices = useCallback(async () => {
    setInvoiceLoading(true);
    try {
      const params: Record<string, any> = { page, limit: 20 };
      if (selectedCompanyId) params.company_id = selectedCompanyId;
      const res = await axiosBaseApi.get("/invoices", {
        params,
      });
      const data = res?.data?.data;
      if (data) {
        setInvoices(data.invoices || []);
        setTotalInvoices(data.pagination?.total || 0);
      }
    } catch (err) {
      console.error("Failed to fetch invoices:", err);
    } finally {
      setInvoiceLoading(false);
    }
  }, [page, selectedCompanyId]);

  // Fetch tax report
  const fetchTaxReport = useCallback(async () => {
    setTaxLoading(true);
    try {
      const params: Record<string, string> = { group_by: groupBy };
      if (selectedCompanyId) params.company_id = String(selectedCompanyId);

      if (taxPeriod !== "all") {
        const now = new Date();
        let startDate: Date;

        switch (taxPeriod) {
          case "thisMonth":
            startDate = new Date(now.getFullYear(), now.getMonth(), 1);
            break;
          case "lastMonth":
            startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            params.end_date = new Date(
              now.getFullYear(),
              now.getMonth(),
              0
            ).toISOString();
            break;
          case "thisQuarter": {
            const q = Math.floor(now.getMonth() / 3) * 3;
            startDate = new Date(now.getFullYear(), q, 1);
            break;
          }
          case "thisYear":
            startDate = new Date(now.getFullYear(), 0, 1);
            break;
          case "lastYear":
            startDate = new Date(now.getFullYear() - 1, 0, 1);
            params.end_date = new Date(
              now.getFullYear() - 1,
              11,
              31
            ).toISOString();
            break;
          default:
            startDate = new Date(2020, 0, 1);
        }

        params.start_date = startDate.toISOString();
        if (!params.end_date) params.end_date = now.toISOString();
      }

      const res = await axiosBaseApi.get("/invoices/tax-report", { params });
      if (res?.data?.data) {
        setTaxReport(res.data.data);
      }
    } catch (err) {
      console.error("Failed to fetch tax report:", err);
    } finally {
      setTaxLoading(false);
    }
  }, [groupBy, taxPeriod]);

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  useEffect(() => {
    if (activeTab === 1) {
      fetchTaxReport();
    }
  }, [activeTab, fetchTaxReport]);

  const handleDownloadPDF = async (invoiceId: number) => {
    try {
      const res = await axiosBaseApi.get(`/invoices/${invoiceId}/pdf`, {
        responseType: "blob",
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `invoice-${invoiceId}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Failed to download invoice PDF:", err);
    }
  };

  const handleExportCSV = async () => {
    try {
      const params: Record<string, string> = {};
      if (selectedCompanyId) params.company_id = String(selectedCompanyId);
      if (taxPeriod !== "all") {
        const now = new Date();
        let startDate: Date;
        let endDate: Date = now;
        switch (taxPeriod) {
          case "thisMonth":
            startDate = new Date(now.getFullYear(), now.getMonth(), 1);
            break;
          case "lastMonth":
            startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            endDate = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
            break;
          case "thisQuarter": {
            const quarter = Math.floor(now.getMonth() / 3);
            startDate = new Date(now.getFullYear(), quarter * 3, 1);
            break;
          }
          case "thisYear":
            startDate = new Date(now.getFullYear(), 0, 1);
            break;
          case "lastYear":
            startDate = new Date(now.getFullYear() - 1, 0, 1);
            endDate = new Date(now.getFullYear() - 1, 11, 31, 23, 59, 59);
            break;
          default:
            startDate = new Date(2020, 0, 1);
        }
        params.start_date = startDate.toISOString();
        params.end_date = endDate.toISOString();
      }

      const res = await axiosBaseApi.get("/invoices/tax-report/csv", {
        params,
        responseType: "blob",
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute(
        "download",
        `tax-report-${new Date().toISOString().split("T")[0]}.csv`
      );
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Failed to export CSV:", err);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const formatCurrency = (amount: number, currency?: string) => {
    const curr = currency || baseCurrency;
    return getCurrencySymbol(curr, amount.toFixed(2));
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  return (
    <>
      <Head>
        <title>Invoices & Tax - DynoPay</title>
      </Head>
      <Box sx={{ px: { xs: "16px", md: 0 } }}>
        {/* Tabs */}
        <Box
          sx={{
            borderBottom: 1,
            borderColor: "divider",
            mb: 3,
          }}
        >
          <Tabs
            value={activeTab}
            onChange={(_, v) => setActiveTab(v)}
            sx={{
              "& .MuiTab-root": {
                fontFamily: "UrbanistMedium",
                fontSize: isMobile ? 13 : 15,
                textTransform: "none",
              },
            }}
          >
            <Tab
              icon={<ReceiptLongRounded sx={{ fontSize: 18 }} />}
              iconPosition="start"
              label="Invoices"
            />
            <Tab
              icon={<AssessmentRounded sx={{ fontSize: 18 }} />}
              iconPosition="start"
              label="Tax Report"
            />
          </Tabs>
        </Box>

        {/* INVOICES TAB */}
        {activeTab === 0 && (
          <Box>
            <PanelCard
              title={`Invoices (${totalInvoices})`}
              showHeaderBorder
              headerPadding={appTheme.spacing(2.5)}
              bodyPadding={appTheme.spacing(0)}
            >
              <TableContainer>
                <Table size={isMobile ? "small" : "medium"}>
                  <TableHead>
                    <TableRow>
                      <TableCell
                        sx={{
                          fontFamily: "UrbanistMedium",
                          fontWeight: 600,
                          color: muiTheme.palette.text.secondary,
                          fontSize: isMobile ? 11 : 13,
                        }}
                      >
                        Invoice #
                      </TableCell>
                      <TableCell
                        sx={{
                          fontFamily: "UrbanistMedium",
                          fontWeight: 600,
                          color: muiTheme.palette.text.secondary,
                          fontSize: isMobile ? 11 : 13,
                        }}
                      >
                        Date
                      </TableCell>
                      {!isMobile && (
                        <TableCell
                          sx={{
                            fontFamily: "UrbanistMedium",
                            fontWeight: 600,
                            color: muiTheme.palette.text.secondary,
                            fontSize: 13,
                          }}
                        >
                          Customer
                        </TableCell>
                      )}
                      <TableCell
                        align="right"
                        sx={{
                          fontFamily: "UrbanistMedium",
                          fontWeight: 600,
                          color: muiTheme.palette.text.secondary,
                          fontSize: isMobile ? 11 : 13,
                        }}
                      >
                        VAT
                      </TableCell>
                      <TableCell
                        align="right"
                        sx={{
                          fontFamily: "UrbanistMedium",
                          fontWeight: 600,
                          color: muiTheme.palette.text.secondary,
                          fontSize: isMobile ? 11 : 13,
                        }}
                      >
                        Total
                      </TableCell>
                      <TableCell
                        align="center"
                        sx={{
                          fontFamily: "UrbanistMedium",
                          fontWeight: 600,
                          color: muiTheme.palette.text.secondary,
                          fontSize: isMobile ? 11 : 13,
                        }}
                      >
                        PDF
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {invoiceLoading
                      ? Array.from({ length: 5 }).map((_, i) => (
                          <TableRow key={i}>
                            <TableCell>
                              <Skeleton width={100} />
                            </TableCell>
                            <TableCell>
                              <Skeleton width={80} />
                            </TableCell>
                            {!isMobile && (
                              <TableCell>
                                <Skeleton width={120} />
                              </TableCell>
                            )}
                            <TableCell align="right">
                              <Skeleton width={60} />
                            </TableCell>
                            <TableCell align="right">
                              <Skeleton width={80} />
                            </TableCell>
                            <TableCell align="center">
                              <Skeleton
                                variant="circular"
                                width={32}
                                height={32}
                              />
                            </TableCell>
                          </TableRow>
                        ))
                      : invoices.length === 0
                        ? (
                          <TableRow>
                            <TableCell
                              colSpan={isMobile ? 5 : 6}
                              align="center"
                              sx={{ py: 4 }}
                            >
                              <Typography
                                sx={{
                                  fontFamily: "UrbanistMedium",
                                  color: muiTheme.palette.text.secondary,
                                  fontSize: 14,
                                }}
                              >
                                No invoices yet. Invoices are auto-generated
                                when transactions complete.
                              </Typography>
                            </TableCell>
                          </TableRow>
                        )
                        : invoices.map((inv) => (
                          <TableRow key={inv.invoice_id} hover>
                            <TableCell>
                              <Typography
                                sx={{
                                  fontFamily: "UrbanistMedium",
                                  fontSize: isMobile ? 12 : 14,
                                  color: muiTheme.palette.text.primary,
                                }}
                              >
                                {inv.invoice_number}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              <Typography
                                sx={{
                                  fontFamily: "UrbanistMedium",
                                  fontSize: isMobile ? 11 : 13,
                                  color: muiTheme.palette.text.secondary,
                                }}
                              >
                                {formatDate(inv.invoice_date)}
                              </Typography>
                            </TableCell>
                            {!isMobile && (
                              <TableCell>
                                <Typography
                                  sx={{
                                    fontFamily: "UrbanistMedium",
                                    fontSize: 13,
                                    color: muiTheme.palette.text.primary,
                                  }}
                                >
                                  {inv.customer_name}
                                </Typography>
                              </TableCell>
                            )}
                            <TableCell align="right">
                              {parseFloat(String(inv.vat_amount)) > 0 ? (
                                <Chip
                                  label={`${formatCurrency(parseFloat(String(inv.vat_amount)), inv.crypto_currency)} (${inv.vat_rate}%)`}
                                  size="small"
                                  sx={{
                                    fontFamily: "UrbanistMedium",
                                    fontSize: isMobile ? 10 : 12,
                                    backgroundColor: "#22C55E1A",
                                    color: "#22C55E",
                                    fontWeight: 500,
                                  }}
                                />
                              ) : (
                                <Typography
                                  sx={{
                                    fontFamily: "UrbanistMedium",
                                    fontSize: isMobile ? 11 : 13,
                                    color: muiTheme.palette.text.secondary,
                                  }}
                                >
                                  —
                                </Typography>
                              )}
                            </TableCell>
                            <TableCell align="right">
                              <Typography
                                sx={{
                                  fontFamily: "UrbanistMedium",
                                  fontSize: isMobile ? 12 : 14,
                                  fontWeight: 500,
                                  color: muiTheme.palette.text.primary,
                                }}
                              >
                                {formatCurrency(
                                  parseFloat(String(inv.total_usd)),
                                  inv.crypto_currency
                                )}
                              </Typography>
                            </TableCell>
                            <TableCell align="center">
                              <Tooltip title="Download PDF">
                                <IconButton
                                  size="small"
                                  onClick={() =>
                                    handleDownloadPDF(inv.invoice_id)
                                  }
                                  sx={{
                                    color: muiTheme.palette.primary.main,
                                  }}
                                >
                                  <DownloadRounded fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            </TableCell>
                          </TableRow>
                        ))}
                  </TableBody>
                </Table>
              </TableContainer>

              {/* Pagination */}
              {totalInvoices > 20 && (
                <Box
                  sx={{
                    display: "flex",
                    justifyContent: "center",
                    gap: 1,
                    py: 2,
                  }}
                >
                  <CustomButton
                    label="Previous"
                    variant="secondary"
                    size="small"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  />
                  <Typography
                    sx={{
                      fontFamily: "UrbanistMedium",
                      fontSize: 13,
                      display: "flex",
                      alignItems: "center",
                      px: 1,
                    }}
                  >
                    Page {page} of {Math.ceil(totalInvoices / 20)}
                  </Typography>
                  <CustomButton
                    label="Next"
                    variant="secondary"
                    size="small"
                    disabled={page >= Math.ceil(totalInvoices / 20)}
                    onClick={() => setPage((p) => p + 1)}
                  />
                </Box>
              )}
            </PanelCard>
          </Box>
        )}

        {/* TAX REPORT TAB */}
        {activeTab === 1 && (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}>
            {/* Controls */}
            <Box
              sx={{
                display: "flex",
                flexWrap: "wrap",
                gap: 2,
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <Box sx={{ display: "flex", gap: 1.5, flexWrap: "wrap" }}>
                <FormControl size="small">
                  <Select
                    value={taxPeriod}
                    onChange={(e) => setTaxPeriod(e.target.value)}
                    sx={{
                      fontFamily: "UrbanistMedium",
                      fontSize: 13,
                      minWidth: 140,
                      height: 36,
                    }}
                  >
                    <MenuItem value="all">All Time</MenuItem>
                    <MenuItem value="thisMonth">This Month</MenuItem>
                    <MenuItem value="lastMonth">Last Month</MenuItem>
                    <MenuItem value="thisQuarter">This Quarter</MenuItem>
                    <MenuItem value="thisYear">This Year</MenuItem>
                    <MenuItem value="lastYear">Last Year</MenuItem>
                  </Select>
                </FormControl>
                <FormControl size="small">
                  <Select
                    value={groupBy}
                    onChange={(e) => setGroupBy(e.target.value)}
                    sx={{
                      fontFamily: "UrbanistMedium",
                      fontSize: 13,
                      minWidth: 120,
                      height: 36,
                    }}
                  >
                    <MenuItem value="month">By Month</MenuItem>
                    <MenuItem value="quarter">By Quarter</MenuItem>
                    <MenuItem value="year">By Year</MenuItem>
                  </Select>
                </FormControl>
              </Box>
              <Box sx={{ display: "flex", gap: 1 }}>
                <CustomButton
                  label={isMobile ? "" : "Export CSV"}
                  startIcon={<FileDownloadRounded sx={{ fontSize: 16 }} />}
                  variant="secondary"
                  size="small"
                  onClick={handleExportCSV}
                  sx={{ fontSize: 13 }}
                />
                <CustomButton
                  label={isMobile ? "" : "Print"}
                  startIcon={<PrintRounded sx={{ fontSize: 16 }} />}
                  variant="secondary"
                  size="small"
                  onClick={handlePrint}
                  sx={{ fontSize: 13 }}
                />
              </Box>
            </Box>

            {/* Summary Cards */}
            <Box
              sx={{
                display: "flex",
                gap: isMobile ? 1.5 : 2.5,
                flexWrap: "wrap",
              }}
            >
              {[
                {
                  label: "Total Revenue",
                  value: taxReport
                    ? formatCurrency(taxReport.summary.total_revenue)
                    : "—",
                  color: muiTheme.palette.text.primary,
                },
                {
                  label: "Tax Collected",
                  value: taxReport
                    ? formatCurrency(taxReport.summary.total_tax)
                    : "—",
                  color: "#22C55E",
                },
                {
                  label: "Total Invoices",
                  value: taxReport
                    ? String(taxReport.summary.total_invoices)
                    : "—",
                  color: muiTheme.palette.primary.main,
                },
              ].map((card) => (
                <Box
                  key={card.label}
                  sx={{
                    flex: isMobile ? "1 1 100%" : "1 1 0",
                    minWidth: isMobile ? "100%" : 180,
                    border: "1px solid",
                    borderColor: muiTheme.palette.divider,
                    borderRadius: "14px",
                    p: isMobile ? 2 : 2.5,
                  }}
                >
                  <Typography
                    sx={{
                      fontFamily: "UrbanistMedium",
                      fontSize: isMobile ? 11 : 13,
                      color: muiTheme.palette.text.secondary,
                      mb: 0.5,
                    }}
                  >
                    {card.label}
                  </Typography>
                  {taxLoading ? (
                    <Skeleton width={80} height={32} />
                  ) : (
                    <Typography
                      sx={{
                        fontFamily: "UrbanistMedium",
                        fontSize: isMobile ? 20 : 28,
                        fontWeight: 500,
                        color: card.color,
                        lineHeight: 1.2,
                      }}
                    >
                      {card.value}
                    </Typography>
                  )}
                </Box>
              ))}
            </Box>

            {/* Tax by Period */}
            <PanelCard
              title="Tax by Period"
              showHeaderBorder
              headerPadding={appTheme.spacing(2.5)}
              bodyPadding={appTheme.spacing(0)}
            >
              <TableContainer>
                <Table size={isMobile ? "small" : "medium"}>
                  <TableHead>
                    <TableRow>
                      <TableCell
                        sx={{
                          fontFamily: "UrbanistMedium",
                          fontWeight: 600,
                          color: muiTheme.palette.text.secondary,
                          fontSize: isMobile ? 11 : 13,
                        }}
                      >
                        Period
                      </TableCell>
                      <TableCell
                        align="right"
                        sx={{
                          fontFamily: "UrbanistMedium",
                          fontWeight: 600,
                          color: muiTheme.palette.text.secondary,
                          fontSize: isMobile ? 11 : 13,
                        }}
                      >
                        Revenue
                      </TableCell>
                      <TableCell
                        align="right"
                        sx={{
                          fontFamily: "UrbanistMedium",
                          fontWeight: 600,
                          color: muiTheme.palette.text.secondary,
                          fontSize: isMobile ? 11 : 13,
                        }}
                      >
                        Tax Collected
                      </TableCell>
                      <TableCell
                        align="right"
                        sx={{
                          fontFamily: "UrbanistMedium",
                          fontWeight: 600,
                          color: muiTheme.palette.text.secondary,
                          fontSize: isMobile ? 11 : 13,
                        }}
                      >
                        Invoices
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {taxLoading ? (
                      Array.from({ length: 3 }).map((_, i) => (
                        <TableRow key={i}>
                          <TableCell><Skeleton width={80} /></TableCell>
                          <TableCell align="right"><Skeleton width={60} /></TableCell>
                          <TableCell align="right"><Skeleton width={60} /></TableCell>
                          <TableCell align="right"><Skeleton width={30} /></TableCell>
                        </TableRow>
                      ))
                    ) : !taxReport || taxReport.by_period.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} align="center" sx={{ py: 3 }}>
                          <Typography
                            sx={{
                              fontFamily: "UrbanistMedium",
                              fontSize: 13,
                              color: muiTheme.palette.text.secondary,
                            }}
                          >
                            No tax data for this period
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ) : (
                      taxReport.by_period.map((row) => (
                        <TableRow key={row.period} hover>
                          <TableCell>
                            <Typography
                              sx={{
                                fontFamily: "UrbanistMedium",
                                fontSize: isMobile ? 12 : 14,
                              }}
                            >
                              {row.period_label}
                            </Typography>
                          </TableCell>
                          <TableCell align="right">
                            <Typography
                              sx={{
                                fontFamily: "UrbanistMedium",
                                fontSize: isMobile ? 12 : 14,
                              }}
                            >
                              {formatCurrency(row.revenue)}
                            </Typography>
                          </TableCell>
                          <TableCell align="right">
                            <Typography
                              sx={{
                                fontFamily: "UrbanistMedium",
                                fontSize: isMobile ? 12 : 14,
                                color: "#22C55E",
                                fontWeight: 500,
                              }}
                            >
                              {formatCurrency(row.tax_collected)}
                            </Typography>
                          </TableCell>
                          <TableCell align="right">
                            <Typography
                              sx={{
                                fontFamily: "UrbanistMedium",
                                fontSize: isMobile ? 12 : 14,
                              }}
                            >
                              {row.invoice_count}
                            </Typography>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </PanelCard>

            {/* Tax by Jurisdiction */}
            <PanelCard
              title="Tax by Jurisdiction"
              showHeaderBorder
              headerPadding={appTheme.spacing(2.5)}
              bodyPadding={appTheme.spacing(0)}
            >
              <TableContainer>
                <Table size={isMobile ? "small" : "medium"}>
                  <TableHead>
                    <TableRow>
                      <TableCell
                        sx={{
                          fontFamily: "UrbanistMedium",
                          fontWeight: 600,
                          color: muiTheme.palette.text.secondary,
                          fontSize: isMobile ? 11 : 13,
                        }}
                      >
                        Country
                      </TableCell>
                      <TableCell
                        align="right"
                        sx={{
                          fontFamily: "UrbanistMedium",
                          fontWeight: 600,
                          color: muiTheme.palette.text.secondary,
                          fontSize: isMobile ? 11 : 13,
                        }}
                      >
                        Tax Rate
                      </TableCell>
                      <TableCell
                        align="right"
                        sx={{
                          fontFamily: "UrbanistMedium",
                          fontWeight: 600,
                          color: muiTheme.palette.text.secondary,
                          fontSize: isMobile ? 11 : 13,
                        }}
                      >
                        Tax Collected
                      </TableCell>
                      <TableCell
                        align="right"
                        sx={{
                          fontFamily: "UrbanistMedium",
                          fontWeight: 600,
                          color: muiTheme.palette.text.secondary,
                          fontSize: isMobile ? 11 : 13,
                        }}
                      >
                        Revenue
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {taxLoading ? (
                      Array.from({ length: 3 }).map((_, i) => (
                        <TableRow key={i}>
                          <TableCell><Skeleton width={80} /></TableCell>
                          <TableCell align="right"><Skeleton width={40} /></TableCell>
                          <TableCell align="right"><Skeleton width={60} /></TableCell>
                          <TableCell align="right"><Skeleton width={60} /></TableCell>
                        </TableRow>
                      ))
                    ) : !taxReport || taxReport.by_jurisdiction.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} align="center" sx={{ py: 3 }}>
                          <Typography
                            sx={{
                              fontFamily: "UrbanistMedium",
                              fontSize: 13,
                              color: muiTheme.palette.text.secondary,
                            }}
                          >
                            No jurisdiction data available
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ) : (
                      taxReport.by_jurisdiction.map((row) => (
                        <TableRow key={row.country} hover>
                          <TableCell>
                            <Typography
                              sx={{
                                fontFamily: "UrbanistMedium",
                                fontSize: isMobile ? 12 : 14,
                              }}
                            >
                              {row.country}
                            </Typography>
                          </TableCell>
                          <TableCell align="right">
                            <Chip
                              label={`${row.tax_rate}%`}
                              size="small"
                              sx={{
                                fontFamily: "UrbanistMedium",
                                fontSize: 11,
                                backgroundColor:
                                  row.tax_rate > 0 ? "#22C55E1A" : "#F3F4F6",
                                color:
                                  row.tax_rate > 0
                                    ? "#22C55E"
                                    : muiTheme.palette.text.secondary,
                              }}
                            />
                          </TableCell>
                          <TableCell align="right">
                            <Typography
                              sx={{
                                fontFamily: "UrbanistMedium",
                                fontSize: isMobile ? 12 : 14,
                                color: "#22C55E",
                                fontWeight: 500,
                              }}
                            >
                              {formatCurrency(row.tax_collected)}
                            </Typography>
                          </TableCell>
                          <TableCell align="right">
                            <Typography
                              sx={{
                                fontFamily: "UrbanistMedium",
                                fontSize: isMobile ? 12 : 14,
                              }}
                            >
                              {formatCurrency(row.revenue)}
                            </Typography>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </PanelCard>
          </Box>
        )}
      </Box>
    </>
  );
};

export default InvoicesPage;
