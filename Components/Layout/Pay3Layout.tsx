import Header from '@/Components/Page/Pay3Components/header';
import Footer from '@/Components/UI/Footer';
import { useThemeMode } from '@/contexts/ThemeContext';
import { Box, useTheme } from '@mui/material';
import React from 'react';

export default function Pay3Layout({
    children,
}: {
    children: React.ReactNode;
}) {
    const { mode, toggleTheme, isDark } = useThemeMode();
    const theme = useTheme();

    return (
        <Box
            sx={{
                minHeight: '100vh',
                display: 'flex',
                flexDirection: 'column',
                background: theme.palette.background.default,
                transition: 'background 0.3s ease',
            }}
        >
            <Header darkMode={isDark} toggleDarkMode={toggleTheme} />
            <Box
                component="main"
                sx={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    py: { xs: 2, sm: 3 },
                }}
            >
                {children}
            </Box>
            <Footer />
        </Box>
    );
}
