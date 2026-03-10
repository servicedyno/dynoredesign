import ApiKeysPage from "@/Components/Page/API/ApiKeysPage";
import CustomButton from "@/Components/UI/Buttons";
import useIsMobile from "@/hooks/useIsMobile";
import { pageProps } from "@/utils/types";
import { AddRounded } from "@mui/icons-material";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";

const APIs = ({
  setPageName,
  setPageDescription,
  setPageAction,
}: pageProps) => {
  const namespaces = ["apiScreen", "common"];
  const isMobile = useIsMobile("md");
  const { t } = useTranslation(namespaces);
  const tApi = useCallback(
    (key: string, defaultValue?: string) =>
      t(key, { ns: "apiScreen", defaultValue }),
    [t],
  );

  const [openCreate, setOpenCreate] = useState(false);
  const apiState = useSelector((state: any) => state?.apiReducer);
  const hasExistingKey = Array.isArray(apiState?.apiList) && apiState.apiList.length > 0;

  useEffect(() => {
    if (setPageName && setPageDescription) {
      setPageName(tApi("apiKeysTitle", "API Keys"));
      setPageDescription(
        tApi(
          "apiKeysDescription",
          "Manage API keys for integrating Dynopay into your applications",
        ),
      );
    }
  }, [setPageName, setPageDescription, tApi]);

  useEffect(() => {
    if (!setPageAction) return;
    // Only show "Create" button if no API key exists (max 1 key per company)
    if (hasExistingKey) {
      setPageAction(null);
    } else {
      setPageAction(
        <CustomButton
          label={isMobile ? tApi("createKeyMobile") : tApi("createNewKey")}
          variant="primary"
          size="medium"
          endIcon={<AddRounded sx={{ fontSize: isMobile ? 18 : 20 }} />}
          onClick={() => setOpenCreate(true)}
          sx={{
            height: isMobile ? 34 : 40,
            px: isMobile ? 1.5 : 2.5,
            fontSize: isMobile ? 13 : 15,
          }}
        />,
      );
    }
    return () => setPageAction(null);
  }, [setPageAction, tApi, isMobile, hasExistingKey]);

  return (
    <>
      <ApiKeysPage openCreate={openCreate} setOpenCreate={setOpenCreate} />
    </>
  );
};

export default APIs;
