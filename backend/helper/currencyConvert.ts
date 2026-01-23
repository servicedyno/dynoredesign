import axios from "axios";

interface CurrencyRateList {
  currency: string;
  amount: number;
  transferRate: number;
}

const currencyConvert = async ({
  currency,
  sourceCurrency,
  amount,
  fixedDecimal,
}) => {
  let source = sourceCurrency.toUpperCase();
  if (source.includes("USDT")) {
    source = "USDT";
  } else if (source.includes("TRON")) {
    source = "TRX";
  } else if (source.includes("BSC")) {
    source = "BNB";
  }
  let currencyRateList: CurrencyRateList[] = [];

  for (let i = 0; i < currency.length; i++) {
    const defaultCurrency: string = currency[i];
    let currentCurrency = currency[i].toUpperCase() as string;
    if (currentCurrency.includes("USDT")) {
      currentCurrency = "USDT";
    } else if (currentCurrency.includes("TRON")) {
      currentCurrency = "TRX";
    } else if (currentCurrency.includes("BSC")) {
      currentCurrency = "BNB";
    }

    if (source !== currentCurrency) {
      const {
        data: { result },
      } = await axios.get(`https://api.fastforex.io/convert`, {
        params: {
          api_key: process.env.FAST_FOREX_KEY,
          from: source,
          to: currentCurrency,
          amount: amount,
        },
      });
      console.log(currentCurrency, result[currentCurrency], result);
      const transferRate = fixedDecimal
        ? result.rate.toFixed(2)
        : result.rate > 1
        ? result.rate.toFixed(2)
        : Number(result.rate).toFixed(8);
      const currentCurrencyAmount = fixedDecimal
        ? result[currentCurrency].toFixed(2)
        : result[currentCurrency] > 1
        ? result[currentCurrency].toFixed(2)
        : Number(result[currentCurrency]).toFixed(8);

      currencyRateList.push({
        currency: defaultCurrency.toUpperCase(),
        amount: Number(currentCurrencyAmount),
        transferRate: Number(transferRate),
      });
    } else {
      currencyRateList.push({
        currency: defaultCurrency.toUpperCase(),
        amount: amount,
        transferRate: 1,
      });
    }
  }
  console.log(currencyRateList);
  return currencyRateList;
};

export default currencyConvert;
