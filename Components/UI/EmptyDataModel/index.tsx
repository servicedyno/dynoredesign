import { Box, Typography } from "@mui/material";
import Image from "next/image";
import CustomButton from "../Buttons";
import Transactions from "@/assets/Icons/Transactions.svg";
import wallet from "@/assets/Icons/wallet.svg";
import apiKey from "@/assets/Icons/api-key.svg";
import paymentLinks from "@/assets/Icons/paymnt-link.svg";
import useIsMobile from "@/hooks/useIsMobile";
import { useTranslation } from "react-i18next";
import { useState } from "react";
import { AddRounded } from "@mui/icons-material";
import { useRouter } from "next/router";
import AddWalletModal from "../AddWalletModal";
import CreateApiModel from "../ApiKeysModel/CreateApiModel";

type PageName = "transactions" | "wallet" | "apiKey" | "payment-links";

interface EmptyDataModelProps {
    pageName: PageName;
}

const EmptyDataModel = ({ pageName }: EmptyDataModelProps) => {
    const isMobile = useIsMobile("md");
    const router = useRouter();
    const { t } = useTranslation("common");

    const [openCreate, setOpenCreate] = useState(false);

    const pageData: Record<
        PageName,
        {
            title: string;
            description: string;
            icon: any;
            buttonLabel: string;
            buttonLink?: string;
            buttonClick?: () => void;
        }
    > = {
        transactions: {
            title: t("EmptyTransactionTitle"),
            description: t("EmptyTransactionDescription"),
            icon: Transactions,
            buttonLabel: t("createPaymentLink"),
            buttonLink: "/create-pay-link",
        },
        wallet: {
            title: t("EmptyWalletTitle"),
            description: t("EmptyWalletDescription"),
            icon: wallet,
            buttonLabel: t("addWallet"),
            buttonClick: () => setOpenCreate(true),
        },
        apiKey: {
            title: t("EmptyApiKeyTitle"),
            description: t("EmptyApiKeyDescription"),
            icon: apiKey,
            buttonLabel: t("createNewKey"),
            buttonClick: () => setOpenCreate(true),
        },
        "payment-links": {
            title: t("EmptyPaymentLinkTitle"),
            description: t("EmptyPaymentLinkDescription"),
            icon: paymentLinks,
            buttonLabel: t("createPaymentLink"),
            buttonLink: "/create-pay-link",
        },
    };

    const data = pageData[pageName];

    const handleButtonClick = () => {
        if (data.buttonLink) {
            router.push(data.buttonLink);
            return;
        }
        data.buttonClick?.();
    };

    return (
        <>
            <Box
                sx={{
                    display: "flex",
                    flex: 1,
                    flexDirection: "column",
                    justifyContent: "center",
                    alignItems: "center",
                    gap: "25px",
                    backgroundColor: "#FFFFFF",
                    borderRadius: "14px",
                }}
            >
                <Image
                    src={data.icon}
                    alt={data.title}
                    width={63}
                    height={49}
                />

                <Box
                    sx={{
                        display: "flex",
                        flexDirection: "column",
                        justifyContent: "center",
                        alignItems: "center",
                        gap: "7px",
                    }}
                >
                    <Typography
                        component="h2"
                        sx={{
                            fontFamily: "UrbanistMedium",
                            fontWeight: 500,
                            fontSize: isMobile ? "16px" : "20px",
                            lineHeight: "100%",
                            letterSpacing: 0,
                            color: "#242428",
                        }}
                    >
                        {data.title}
                    </Typography>

                    <Typography
                        component="p"
                        sx={{
                            fontFamily: "UrbanistMedium",
                            fontWeight: 500,
                            fontSize: isMobile ? "12px" : "15px",
                            lineHeight: "100%",
                            letterSpacing: 0,
                            color: "#676768",
                        }}
                    >
                        {data.description}
                    </Typography>
                </Box>

                <CustomButton
                    label={data.buttonLabel}
                    variant="primary"
                    size="medium"
                    endIcon={<AddRounded sx={{ fontSize: isMobile ? 18 : 20 }} />}
                    onClick={handleButtonClick}
                    sx={{
                        height: isMobile ? 34 : 40,
                        px: isMobile ? 1.5 : 2.5,
                        fontSize: isMobile ? 13 : 15,
                        color: "#FFFFFF",
                    }}
                />
            </Box>

            {pageName === "wallet" && openCreate && (
                <AddWalletModal
                    open
                    onClose={() => setOpenCreate(false)}
                />
            )}

            {pageName === "apiKey" && (
                <CreateApiModel open={openCreate} onClose={() => setOpenCreate(false)} />
            )}
        </>
    );
};

export default EmptyDataModel;