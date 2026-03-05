import HomePage from "@/Components/Page/Home";
import { Box } from "@mui/material";
import { memo } from "react";

const Home = () => {
  return (
    <Box height={"100%"} width={"100%"}>
      <HomePage />
    </Box>
  );
};

export default memo(Home);
