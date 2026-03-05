import React from "react";
import { Box, Typography } from "@mui/material";
import { useRouter } from "next/router";

const BrandLogo = ({ redirect = true }: { redirect?: boolean }) => {
  const router = useRouter();
  return (
    <>
      <Box
        sx={{
          mt: 2,
          display: { lg: "block", xs: "none" },
          "& img": {
            width: "40px",
            height: "auto",
          },
          cursor: "pointer",
        }}
        onClick={() => redirect && router.push("/")}
      >
        {/* <img src={Logo.src} alt="no logo" /> */}
        <Typography sx={{ fontSize: "45px", lineHeight: 1 }}>D</Typography>
      </Box>
    </>
  );
};

export default BrandLogo;
