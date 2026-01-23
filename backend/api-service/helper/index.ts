import currencyConvert from "./currencyConvert";
import downloadUserImage from "./downloadUserImage";
import { decrypt, encrypt } from "./encryption";
import errorResponseHelper from "./errorResponseHelper";
import getErrorMessage from "./getErrorMessage";
import sendEmail from "./sendEmail";
import successResponseHelper from "./successResponseHelper";

const getMinutesBetweenDates = (startDate, endDate) => {
  const diff = endDate.getTime() - startDate.getTime();

  return Math.abs(diff / 60000);
};

export {
  downloadUserImage,
  sendEmail,
  successResponseHelper,
  errorResponseHelper,
  getErrorMessage,
  getMinutesBetweenDates,
  encrypt,
  decrypt,
  currencyConvert,
};
