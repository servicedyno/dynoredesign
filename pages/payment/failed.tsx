import { useRouter } from "next/router";
import React, { useEffect } from "react";

const Success = () => {
  const router = useRouter();
  useEffect(() => {
    if (router.query && router.query.response) {
      const successRes = JSON.parse(router.query.response as string);

      console.log(successRes);
    }
  }, [router.query]);
  return <div>Failed</div>;
};

export default Success;
