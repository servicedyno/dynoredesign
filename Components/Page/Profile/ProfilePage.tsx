import { Grid } from "@mui/material";

import { TokenData } from "@/utils/types";
import AccountSetting from "./AccountSetting";
import UpdatePassword from "./UpdatePassword";

const ProfilePage = ({ tokenData }: { tokenData: TokenData }) => {
  return (
    <Grid container columnSpacing={2.5} sx={{ rowGap: "14px" }}>
      <Grid item md={6.89} xs={12}>
        <AccountSetting tokenData={tokenData} />
      </Grid>
      <Grid item md={5.11} xs={12}>
        <UpdatePassword />
      </Grid>
    </Grid>
  );
};

export default ProfilePage;
