import express from "express";
import { apiLogger } from "../utils/loggers";
import { errorResponseHelper, getErrorMessage } from "../helper";
import { ITatumWebHook, IWebHook } from "../utils/types";
import { getRedisItem, setRedisItem } from "../utils/redisInstance";
import axios from "axios";
import { paymentController } from "../controller";

const flutterwaveWebHook = async (
  req: express.Request,
  res: express.Response
) => {
  try {
    const secretHash = process.env.FLW_SECRET_HASH;
    const signature = req.headers["verif-hash"];
    if (!signature || signature !== secretHash) {
      res.status(401).end();
    }
    const payload: IWebHook = req.body;
    const txRef = payload.txRef.includes("customer")
      ? payload.txRef
      : "flw-txt-" + payload.txRef;
    const items = await getRedisItem(txRef);
    console.log("here==========>", payload.id, payload.status, items);
    await setRedisItem(txRef, {
      ...items,
      id: payload.id,
      status: payload.status,
    });

    console.log("IWebHook=============>", payload);
    res.status(200).end();
  } catch (e) {
    const message = getErrorMessage(e);
    apiLogger.error(message, { from: "flutterwave_webhook" }, new Error(e));
    res.status(401).end();
  }
};
const tatumWebHook = async (req: express.Request, res: express.Response) => {
  const payload: ITatumWebHook = req.body;
  let address = payload.address;
  let items;
  items = await getRedisItem("crypto-" + address);
  if (Object.keys(items).length < 1) {
    address = payload.counterAddress;
    items = await getRedisItem("crypto-" + address);
  }
  console.log("items===========>", items, payload);
  let newPayload;
  if (Object.keys(items).length > 0) {
    if (
      Number(items.amount) >= Number(payload.amount) ||
      Number(payload.amount) > 0
    ) {
      newPayload = {
        ...items,
        status: "successful",
      };
      console.log("here payload");
    } else {
      newPayload = {
        ...items,
        status: "failed",
        message: "your amount is less then required amount!",
      };
    }

    if (!items?.txId && Number(payload.amount) > 0) {
      await setRedisItem("crypto-" + address, {
        ...newPayload,
        txId: payload.txId,
        receivedAmount: payload.amount,
      });
    }
  }
  res.status(200).end();
};

const tatumCryptoWebHook = async (
  req: express.Request,
  res: express.Response
) => {
  try {
    const payload: ITatumWebHook = req.body;

    let address = payload.address;
    let items = await getRedisItem("crypto-" + address);

    if (!items || Object.keys(items).length === 0) {
      address = payload.counterAddress;
      items = await getRedisItem("crypto-" + address);
    }

    if (!items || Object.keys(items).length === 0) {
      return res.status(200).end();
    }

    const incomingAmount = Number(payload.amount);
    if (!Number.isFinite(incomingAmount) || incomingAmount <= 0) {
      return res.status(200).end();
    }

    const previousReceived = Number(items.receivedAmount ?? 0);
    const totalReceived = previousReceived + incomingAmount;

    await setRedisItem("crypto-" + address, {
      ...items,
      receivedAmount: totalReceived,
      txId: items.txId ?? payload.txId,
    });

    paymentController.cryptoVerification(address, true);

    return res.status(200).end();
  } catch {
    return res.status(200).end();
  }
};


export { flutterwaveWebHook, tatumWebHook, tatumCryptoWebHook };
