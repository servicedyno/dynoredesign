import arraySorting from "./arraySorting";
import currencyConvert from "./currencyConvert";
import downloadUserImage from "./downloadUserImage";
import { decrypt, encrypt } from "./encryption";
import errorResponseHelper from "./errorResponseHelper";
import getErrorMessage from "./getErrorMessage";
import sendEmail, {
  sendPaymentReceivedEmail,
  sendPaymentPendingEmail,
  sendPaymentConfirmingEmail,
  sendPaymentPartialEmail,
  sendPaymentPartialExpiredEmail,
  sendTransactionConfirmedEmail,
  sendAdminFeeReceivedEmail,
  sendWeeklySummaryEmail,
  sendSecurityAlertEmail,
  dynoPayEmailTemplate,
} from "./sendEmail";
import successResponseHelper from "./successResponseHelper";

const getMinutesBetweenDates = (startDate, endDate) => {
  const diff = endDate.getTime() - startDate.getTime();

  return Math.abs(diff / 60000);
};

// Helper to construct URLs properly with or without trailing slash
export const buildUrl = (path: string): string => {
  const baseUrl = process.env.SERVER_URL || '';
  const normalizedBase = baseUrl.endsWith('/') ? baseUrl : baseUrl + '/';
  const normalizedPath = path.startsWith('/') ? path.substring(1) : path;
  return normalizedBase + normalizedPath;
};

export {
  downloadUserImage,
  sendEmail,
  sendPaymentReceivedEmail,
  sendPaymentPendingEmail,
  sendPaymentConfirmingEmail,
  sendPaymentPartialEmail,
  sendPaymentPartialExpiredEmail,
  sendTransactionConfirmedEmail,
  sendAdminFeeReceivedEmail,
  sendWeeklySummaryEmail,
  sendSecurityAlertEmail,
  dynoPayEmailTemplate,
  successResponseHelper,
  errorResponseHelper,
  getErrorMessage,
  getMinutesBetweenDates,
  encrypt,
  decrypt,
  currencyConvert,
  arraySorting,
};
