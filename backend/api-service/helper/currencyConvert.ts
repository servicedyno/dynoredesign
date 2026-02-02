import { load } from "cheerio";
import axios from "axios";

const replaceAll = (text: string, queryString: string, replaceString: string): string => {
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

/**
 * Currency conversion using Google search (legacy fallback)
 * Note: Main backend uses CoinGecko/FastForex APIs - this is a fallback for api-service
 */
const currencyConvert = async ({ from, to, amount }: { from: string; to: string; amount: number }): Promise<number> => {
  try {
    const response = await axios.get(
      `https://www.google.com/search?q=${amount}+${from}+to+${to}+&hl=en`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      }
    );
    
    const $ = load(response.data);
    let rates: any = $(".iBp4i").text().split(" ")[0];
    
    if (rates.includes(",")) {
      rates = replaceAll(rates, ",", "");
    }
    
    rates = parseFloat(rates) / amount;
    return rates;
  } catch (error) {
    console.error('[currencyConvert] Error fetching rate:', error);
    throw error;
  }
};

export default currencyConvert;
