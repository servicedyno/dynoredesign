import useIsMobile from "@/hooks/useIsMobile";
import { Box, Button } from "@mui/material";
import { useTranslation } from "react-i18next";
import CallIcon from "@/assets/Icons/CallIcon.svg";
import MessageIcon from "@/assets/Icons/MessageIcon.svg";
import Image from "next/image";
import {
    FooterCard,
    FooterIconButton,
    SearchIconButton,
    TextDecoration,
} from "./styled";
import ArrowOutwardIcon from "@mui/icons-material/ArrowOutward";
import { theme } from "@/styles/theme";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import HelpAndSupportData from "@/hooks/useHelpAndSupportData";
import SearchIcon from "@/assets/Icons/search-icon.svg";

const HelpAndSupport = () => {
    const isMobile = useIsMobile("md");
    const { t } = useTranslation("helpAndSupport");
    const router = useRouter();
    const [searchTerm, setSearchTerm] = useState("");
    const [filteredData, setFilteredData] = useState(HelpAndSupportData);

    const handleSearch = () => {
        if (!searchTerm.trim()) {
            setFilteredData(HelpAndSupportData);
            return;
        }

        const filtered = HelpAndSupportData.filter(item =>
            item.title.toLowerCase().includes(searchTerm.toLowerCase())
        );

        setFilteredData(filtered);
    };

    const footerData = [
        {
            contectType: t("cllaUs"),
            contectDetail: "+1 892 8444-531",
            buttonContent: "",
            icon: CallIcon,
            responseTime: "Mon–Fri, 9 AM – 6 PM (ET)",
        },
        {
            contectType: t("emailUs"),
            contectDetail: "info@nameword.com",
            buttonContent: "",
            icon: MessageIcon,
            responseTime: t("emaiResponseTime"),
        },
        {
            contectType: t("chatUs"),
            contectDetail: "",
            buttonContent: t("openChat"),
            icon: MessageIcon,
            responseTime: t("chatResponseTime"),
        },
    ];

    useEffect(() => {
        document.addEventListener("keydown", (e) => {
            if (e.key === "Enter") {
                handleSearch();
            }
        });
    }, [handleSearch]);

    useEffect(() => {
        if (searchTerm === "") {
            setFilteredData(HelpAndSupportData);
        }
    }, [searchTerm])

    return (
        <Box
            sx={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                overflow: "auto"
            }}
        >
            <Box sx={{ position: "sticky", top: 0, left: 0, pb: "20px", backgroundColor: theme.palette.secondary.main, zIndex: 1 }}>
                <Box sx={{ display: "flex", gap: "8px", alignItems: "center" }}>
                    <Box
                        sx={{
                            "& input:focus": {
                                borderColor: "#0004FF",
                            },
                        }}>
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder={t("searchPlaceholder")}
                            style={{
                                height: isMobile ? "32px" : "40px",
                                width: isMobile ? "300px" : "639px",
                                fontSize: isMobile ? "10px" : "13px",
                                fontFamily: "UrbanistMedium",
                                lineHeight: "100%",
                                letterSpacing: 0,
                                fontWeight: 500,
                                padding: "12px 13.5px",
                                border: "1px solid #E9ECF2",
                                backgroundColor: "#FFFFFF",
                                borderRadius: "6px",
                                outline: "none",
                                transition: "0.2s",
                            }}
                        />
                    </Box>
                    <SearchIconButton onClick={handleSearch}>
                        <Image src={SearchIcon} alt="search" width={20} height={20} />
                    </SearchIconButton>
                </Box>
            </Box>

            <Box sx={{ flex: 1, display: "flex", flexDirection: "column", gap: "20px", }}>
                <Box
                    sx={{
                        display: "flex",
                        flexWrap: "wrap",
                        width: "100%",
                        gap: "24px",
                        justifyContent: "flex-start",
                    }}
                >
                    {filteredData.map((item, index) => (
                        <Box
                            key={index}
                            sx={{
                                width: isMobile ? "330px" : "355px",
                                height: isMobile ? "160px" : "202px",
                                backgroundColor: "#FFFFFF",
                                border: "1px solid #E9ECF2",
                                borderRadius: "14px",
                                display: "flex",
                                flexDirection: "column",
                                justifyContent: "space-between",
                                padding: "20px",
                            }}
                        >
                            <TextDecoration style={{ fontSize: isMobile ? "15px" : "20px", color: "#242428" }}>
                                {item.title}
                            </TextDecoration>
                            <TextDecoration style={{ fontSize: isMobile ? "13px" : "15px", color: "#676768" }}>
                                {item.description}
                            </TextDecoration>

                            <SearchIconButton
                                style={{
                                    marginLeft: "auto",
                                    borderColor: theme.palette.text.secondary,
                                }}
                                onClick={() => router.push(`/help-support/${item.slug}`)}
                            >
                                <ArrowOutwardIcon
                                    sx={{ color: theme.palette.text.secondary, fontSize: 18.5 }}
                                />
                            </SearchIconButton>
                        </Box>
                    ))}
                </Box>

                <TextDecoration sx={{ fontSize: "24px" }}>{t("needHelp")}</TextDecoration>

                <Box
                    sx={{
                        border: "1px solid #E9ECF2",
                        p: "20px",
                        display: "flex",
                        flexDirection: isMobile ? "column" : "row",
                        gap: isMobile ? "40px" : "",
                        backgroundColor: "#FFFFFF",
                        borderRadius: "14px",
                    }}
                >
                    {footerData.map((item) => (
                        <FooterCard key={item.contectType}>
                            <Box>
                                <FooterIconButton
                                    style={{
                                        height: "58px",
                                        width: "58px",
                                        marginLeft: "auto",
                                        borderColor: "#D7D7D7",
                                    }}
                                >
                                    <Image src={item.icon} alt="search" width={24} height={24} />
                                </FooterIconButton>
                            </Box>
                            <TextDecoration style={{ fontSize: isMobile ? "10px" :"13px" }}>
                                {item.contectType}
                            </TextDecoration>
                            {item.buttonContent ? (
                                <Button
                                    sx={{
                                        border: "1px solid #0004FF",
                                        borderRadius: "6px",
                                        display: "flex",
                                        justifyContent: "center",
                                        alignItems: "center",
                                        gap: "6px",
                                        padding: isMobile ? "8px 16px" : "10px 25px",
                                        color: "#0004FF",
                                    }}
                                >
                                    <TextDecoration style={{ fontSize: isMobile ? "10px" :"13px" }}>
                                        {item.buttonContent}
                                    </TextDecoration>
                                    <ArrowOutwardIcon sx={{ color: "#0004FF", fontSize: 15 }} />
                                </Button>
                            ) : (
                                <TextDecoration style={{ fontSize: isMobile ? "14px" :"18px", color: "#191339" }}>
                                    {item.contectDetail}
                                </TextDecoration>
                            )}
                            <TextDecoration style={{ fontSize: isMobile ? "10px" :"12px" }}>
                                {item.responseTime}
                            </TextDecoration>
                        </FooterCard>
                    ))}
                </Box>
            </Box>
        </Box>
    );
};

export default HelpAndSupport;
