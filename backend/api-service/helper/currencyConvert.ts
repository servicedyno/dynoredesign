import { load } from "cheerio";
import request from "request";

const replaceAll = (text, queryString, replaceString) => {
  let text_ = "";
  for (let i = 0; i < text.length; i++) {
    if (text[i] === queryString) {
      text_ += replaceString;
    } else {
      text_ += text[i];
    }
  }
  return text_;
};

const currencyConvert = async ({ from, to, amount }) => {
  return new Promise((resolve, reject) => {
    request(
      `https://www.google.com/search?q=${amount}+${from}+to+${to}+&hl=en`,
      function (error, response, body) {
        if (error) {
          return reject(error);
        } else {
          resolve(body);
        }
      }
    );
  })
    .then((body: any) => {
      return load(body);
    })
    .then(($) => {
      return $(".iBp4i").text().split(" ")[0];
    })
    .then((rates: any) => {
      if (rates.includes(",")) rates = replaceAll(rates, ",", "");

      rates = parseFloat(rates) / amount;

      return rates;
    });
};

export default currencyConvert;
