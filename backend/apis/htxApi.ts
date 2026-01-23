import { HmacSHA256 } from "crypto-js";
import CryptoJS from "crypto-js";

const sign_sha = (method, baseurl, path, data) => {
  var pars = [];
  for (let item in data) {
    pars.push(item + "=" + encodeURIComponent(data[item]));
  }
  var p = pars.sort().join("&");
  var meta = [method, baseurl, path, p].join("\n");
  console.log(meta);
  var hash = HmacSHA256(meta, process.env.CRYPTO_SECRET_KEY);
  var Signature = encodeURIComponent(CryptoJS.enc.Base64.stringify(hash));
  console.log(`Signature: ${Signature}`);
  p += `&Signature=${Signature}`;
  console.log(p);
  return p;
};

export default sign_sha;
