import CopyIcon from "@/assets/Icons/copy-icon.svg";
import Help_Support from "@/assets/Icons/Help&Support.svg";
import BGOverlay from "@/assets/Images/bg-overlay.png";
import {
  CopyButton,
  HelpSupportBtn,
  KnowledgeBaseTitle,
  ReferralCard,
  ReferralCardContent,
  ReferralCardContentValue,
  ReferralCardContentValueContainer,
  ReferralCardTitle,
  SidebarFooter,
} from "@/Components/Layout/NewSidebar/styled";
import Toast from "@/Components/UI/Toast";
import { Box } from "@mui/material";
import Image from "next/image";
import { useRouter } from "next/router";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import axiosBaseApi from "@/axiosConfig";

const ReferralAndKnowledge = ({ isMobile }: { isMobile: boolean }) => {
  const router = useRouter();
  const { t } = useTranslation("common");
  const tCommon = useCallback((key: string) => t(key, { ns: "common" }), [t]);
  const [openToast, setOpenToast] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [referralCode, setReferralCode] = useState("DYNO2024XYZ");

  useEffect(() => {
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    if (!token) return;
    axiosBaseApi.get("/referral/my-code")
      .then((res) => {
        const code = res?.data?.data?.referral_code;
        if (code) setReferralCode(code);
      })
      .catch(() => {});
  }, []);

  const handleCopy = () => {
    navigator.clipboard.writeText(referralCode);
    setOpenToast(false);

    setTimeout(() => {
      setOpenToast(true);
    }, 0);

    if (toastTimer.current) {
      clearTimeout(toastTimer.current);
    }

    toastTimer.current = setTimeout(() => {
      setOpenToast(false);
    }, 2000);
  };

  return (
    <SidebarFooter>
      <ReferralCard>
        <Box
          sx={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            userSelect: "none",
          }}
        >
          <Image
            src={BGOverlay}
            alt="BG Overlay"
            width={82}
            height={100}
            draggable={false}
          />
        </Box>
        <ReferralCardContent>
          <ReferralCardTitle>{t("yourReferralCode")}</ReferralCardTitle>

          <ReferralCardContentValueContainer>
            <ReferralCardContentValue>{referralCode}</ReferralCardContentValue>
            <CopyButton onClick={handleCopy}>
              <Image
                src={CopyIcon}
                alt="Copy Icon"
                width={isMobile ? 12 : 14}
                height={isMobile ? 12 : 14}
                draggable={false}
              />
            </CopyButton>
          </ReferralCardContentValueContainer>
        </ReferralCardContent>
      </ReferralCard>

      <HelpSupportBtn onClick={() => router.push("/help-support")}>
        <Image
          src={Help_Support}
          alt="File Icon"
          width={isMobile ? 14 : 18}
          height={isMobile ? 14 : 18}
          draggable={false}
        />
        <KnowledgeBaseTitle>{t("helpSupport")}</KnowledgeBaseTitle>
      </HelpSupportBtn>
      <Toast
        open={openToast}
        message={tCommon("copiedToClipboard")}
        severity="success"
      />
    </SidebarFooter>
  );
};

export default ReferralAndKnowledge;
