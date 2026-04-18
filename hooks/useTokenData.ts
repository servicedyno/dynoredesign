import { TokenData } from "@/utils/types";
import React, { useState, useEffect } from "react";
import jwt from "jsonwebtoken";
const useTokenData = () => {
  const [tokenData, setTokenData] = useState<TokenData>();
  useEffect(() => {
    const token = jwt.decode(localStorage.getItem("token") ?? "") as TokenData;
    setTokenData(token);
  }, []);

  return tokenData;
};

export default useTokenData;
