import { useRouter } from "next/router";
import React, { useEffect } from "react";

const tempObj = {
  id: 6486648,
  txRef: "74a7d884a2217c7bd6d50b494fec6f8ec75db171f86a69ef",
  orderRef: "URF_1721653519327_8457635",
  flwRef: "FLW-MOCK-822974e045b66c344df51805d823816d",
  redirectUrl: "http://localhost:3000/payment/success",
  device_fingerprint: "N/A",
  settlement_token: null,
  cycle: "one-time",
  amount: 450,
  charged_amount: 450,
  appfee: 17.1,
  merchantfee: 0,
  merchantbearsfee: 1,
  chargeResponseCode: "00",
  raveRef: "RV317216535193251FB8DA0B77",
  chargeResponseMessage:
    "Please enter the OTP sent to your mobile number 080****** and email te**@rave**.com",
  authModelUsed: "VBVSECURECODE",
  currency: "USD",
  IP: "52.209.154.143",
  narration: "CARD Transaction ",
  status: "successful",
  modalauditid: "44931db732c01fd07b0fd2ed7730037f",
  vbvrespmessage: "Approved. Successful",
  authurl:
    "https://ravesandboxapi.flutterwave.com/mockvbvpage?ref=FLW-MOCK-822974e045b66c344df51805d823816d&code=00&message=Approved.%20Successful&receiptno=RN1721653520797",
  vbvrespcode: "00",
  acctvalrespmsg: null,
  acctvalrespcode: "RN1721653520797",
  paymentType: "card",
  paymentPlan: null,
  paymentPage: null,
  paymentId: "6528170",
  fraud_status: "ok",
  charge_type: "normal",
  is_live: 0,
  retry_attempt: null,
  getpaidBatchId: null,
  createdAt: "2024-07-22T13:05:20.000Z",
  updatedAt: "2024-07-22T13:05:28.000Z",
  deletedAt: null,
  customerId: 2455405,
  AccountId: 2502658,
  customer: {
    id: 2455405,
    phone: null,
    fullName: "Krushang12 Chauhan",
    customertoken: null,
    email: "krushangnc@gmail.com",
    createdAt: "2024-07-22T13:05:19.000Z",
    updatedAt: "2024-07-22T13:05:19.000Z",
    deletedAt: null,
    AccountId: 2502658,
  },
  chargeToken: {
    user_token: "8ddb7",
    embed_token: "flw-t0-f85cd2edb8972b0eb79defc2af23b711-m03k",
  },
  airtime_flag: false,
};

const Success = () => {
  const router = useRouter();
  useEffect(() => {
    if (router.query && router.query.response) {
      const successRes = JSON.parse(router.query.response as string);

      console.log(successRes);
    }
  }, [router.query]);
  return <div>Success</div>;
};

export default Success;
