import arraySorting from "./arraySorting";
import currencyConvert from "./currencyConvert";
import downloadUserImage from "./downloadUserImage";
import { decrypt, encrypt } from "./encryption";
import errorResponseHelper from "./errorResponseHelper";
import getErrorMessage from "./getErrorMessage";
import sendEmail, {
  sendPaymentReceivedEmail,
  sendTransactionConfirmedEmail,
  sendWeeklySummaryEmail,
  sendSecurityAlertEmail,
  dynoPayEmailTemplate,
} from "./sendEmail";
import successResponseHelper from "./successResponseHelper";

const getMinutesBetweenDates = (startDate, endDate) => {
  const diff = endDate.getTime() - startDate.getTime();

  return Math.abs(diff / 60000);
};

export {
  downloadUserImage,
  sendEmail,
  sendPaymentReceivedEmail,
  sendTransactionConfirmedEmail,
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
