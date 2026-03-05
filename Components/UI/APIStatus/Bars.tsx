import React from "react";
import { Box } from "@mui/material";
import useIsMobile from "@/hooks/useIsMobile";

const Bars = () => {
    const isMobile = useIsMobile();

    const BAR_WIDTH = isMobile ? 1.27 : 5.27;
    const BAR_GAP = 2;
    const BAR_HEIGHT = 32;
    const TOTAL_DAYS = 90;
    const BAR_RADIUS = isMobile ? .8 : 3;

    const uptimeData = Array.from({ length: TOTAL_DAYS }, () => ({
        status: "up",
    }));

    const svgWidth = TOTAL_DAYS * (BAR_WIDTH + BAR_GAP);

    const getColor = (status: string) => {
        if (status === "down") return "#EF4444";
        if (status === "partial") return "#676B7E";
        return "#22C55E";
    };

    return (
        <Box
            sx={{
                display: "flex",
                justifyContent: "space-between",
                gap: "2px",
                mt: "16px",
                fontFamily: "OutfitRegular",
                opacity: 0.9,
            }}
        >
            <svg
                width="100%"
                height={BAR_HEIGHT}
                viewBox={`0 0 ${svgWidth} ${BAR_HEIGHT}`}
                preserveAspectRatio="none"
            >
                {uptimeData.map((day, index) => {
                    const x = index * (BAR_WIDTH + BAR_GAP);

                    return (
                        <rect
                            key={index}
                            x={x}
                            y={0}
                            width={BAR_WIDTH}
                            height={BAR_HEIGHT}
                            rx={BAR_RADIUS}
                            ry={BAR_RADIUS}
                            fill={getColor(day.status)}
                            style={{
                                cursor: "pointer",
                                transition: "opacity 0.2s ease",
                                borderRadius: "8px",
                            }}
                            onMouseEnter={(e) =>
                                (e.currentTarget.style.opacity = "0.7")
                            }
                            onMouseLeave={(e) =>
                                (e.currentTarget.style.opacity = "1")
                            }
                        />
                    );
                })}
            </svg>
        </Box>
    );
};

export default Bars;