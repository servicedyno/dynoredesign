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
                background: theme.palette.background.default,
                transition: 'background 0.3s ease',
            }}
        >
            <Header darkMode={isDark} toggleDarkMode={toggleTheme} />
            <main style={{ minHeight: 'calc(100vh - 210px)' }}>
                {children}
            </main>
            <Footer />
        </Box>
    );
}
