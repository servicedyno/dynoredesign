'use client';

import { useState } from 'react';
import {
  AppBar,
  Toolbar,
  Box,
  IconButton,
  Drawer,
  Stack,
  Select,
  MenuItem,
  FormControl,
  Button,
  useMediaQuery,
  useTheme
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import WbSunnyIcon from '@mui/icons-material/WbSunny';
import BedtimeIcon from '@mui/icons-material/Bedtime';
import { Icon } from '@iconify/react/dist/iconify.js';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'next/router';
import Logo from "@/assets/Icons/Logo";

const Header = ({
  darkMode,
  toggleDarkMode
}: {
  darkMode: boolean;
  toggleDarkMode: () => void;
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { t } = useTranslation('common');
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const toggleDrawer = () => setDrawerOpen(!drawerOpen);

  const handleLanguageChange = (event: any) => {
    const newLocale = event.target.value as string;
    document.cookie = `NEXT_LOCALE=${newLocale}; path=/; max-age=31536000; SameSite=Lax`;
    const { pathname, asPath, query } = router;
    router.replace({ pathname, query }, asPath, { locale: newLocale });
  };

  return (
    <>
      <AppBar
        position='static'
        elevation={0}
        sx={{
          background: darkMode
            ? 'linear-gradient(90deg, #0d0d1a 0%, #1a1a2e 100%)'
            : 'linear-gradient(90deg, #0004FF 0%, #3D40FF 50%, #6C6FFF 100%)',
          height: '60px',
          justifyContent: 'center',
        }}
      >
        <Toolbar
          sx={{
            justifyContent: 'space-between',
            minHeight: '60px !important',
            px: { xs: 2, md: 4 },
          }}
        >
          {/* Left: Logo */}
          <Box display='flex' alignItems='center'>
            <Logo width={36} height={42} />
          </Box>

          {/* Right */}
          {isMobile ? (
            <IconButton onClick={toggleDrawer} sx={{ color: 'white' }}>
              <MenuIcon />
            </IconButton>
          ) : (
            <Stack direction='row' spacing={2} alignItems='center'>
              {/* Wallet */}
              <Button
                startIcon={<Icon icon="solar:wallet-linear" width="18" height="18" />}
                variant='contained'
                size='small'
                sx={{
                  backgroundColor: 'rgba(255,255,255,0.15)',
                  color: '#fff',
                  borderRadius: 20,
                  px: 2,
                  py: 0.75,
                  textTransform: 'none',
                  fontSize: '13px',
                  fontWeight: 600,
                  boxShadow: 'none',
                  backdropFilter: 'blur(8px)',
                  '&:hover': {
                    backgroundColor: 'rgba(255,255,255,0.25)',
                    boxShadow: 'none',
                  },
                  height: '36px',
                }}
              >
                {t('header.wallet')}
              </Button>

              {/* Language */}
              <FormControl variant="standard" size="small">
                <Select
                  value={router.locale || 'en'}
                  onChange={handleLanguageChange}
                  onOpen={() => setOpen(true)}
                  onClose={() => setOpen(false)}
                  disableUnderline
                  IconComponent={() => (
                    <KeyboardArrowDownIcon
                      sx={{
                        color: 'white',
                        fontSize: 18,
                        transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
                        transition: 'transform 0.3s ease',
                      }}
                    />
                  )}
                  sx={{
                    color: 'white',
                    fontWeight: 600,
                    fontSize: '13px',
                    '& .MuiSelect-select': { py: 0.5 },
                  }}
                  MenuProps={{
                    PaperProps: {
                      sx: { mt: 1, borderRadius: 2 },
                    },
                  }}
                >
                  <MenuItem value="en">EN</MenuItem>
                  <MenuItem value="fr">FR</MenuItem>
                  <MenuItem value="es">ES</MenuItem>
                  <MenuItem value="pt">PT</MenuItem>
                  <MenuItem value="de">DE</MenuItem>
                  <MenuItem value="nl">NL</MenuItem>
                </Select>
              </FormControl>

              {/* Theme Toggle — compact */}
              <Box
                onClick={toggleDarkMode}
                sx={{
                  width: 60,
                  height: 30,
                  backgroundColor: 'rgba(255,255,255,0.2)',
                  borderRadius: 999,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  px: '3px',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                }}
              >
                <Box
                  sx={{
                    width: 24,
                    height: 24,
                    backgroundColor: !darkMode ? '#fff' : 'transparent',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.3s ease',
                  }}
                >
                  <WbSunnyIcon sx={{ fontSize: 14, color: !darkMode ? '#0004FF' : 'rgba(255,255,255,0.5)' }} />
                </Box>
                <Box
                  sx={{
                    width: 24,
                    height: 24,
                    backgroundColor: darkMode ? '#fff' : 'transparent',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.3s ease',
                  }}
                >
                  <BedtimeIcon sx={{ fontSize: 14, color: darkMode ? '#0004FF' : 'rgba(255,255,255,0.5)' }} />
                </Box>
              </Box>
            </Stack>
          )}
        </Toolbar>
      </AppBar>

      {/* Mobile Drawer */}
      <Drawer
        anchor='right'
        open={drawerOpen}
        onClose={toggleDrawer}
        sx={{
          '& .MuiDrawer-paper': {
            width: 240,
            p: 2,
            backgroundColor: darkMode ? '#1a1a2e' : '#fff',
          },
        }}
      >
        <Stack spacing={2} mt={1}>
          <Button
            startIcon={<Icon icon="solar:wallet-linear" width="18" height="18" />}
            variant='outlined'
            size='small'
            sx={{
              borderColor: '#0004FF',
              color: '#0004FF',
              borderRadius: 20,
              textTransform: 'none',
              fontSize: '13px',
              fontWeight: 600,
            }}
          >
            {t('header.wallet')}
          </Button>

          <FormControl variant='standard' size='small' sx={{ minWidth: 100 }}>
            <Select
              value={router.locale || 'en'}
              onChange={(e) => {
                handleLanguageChange(e);
                toggleDrawer();
              }}
            >
              <MenuItem value='en'>EN</MenuItem>
              <MenuItem value='fr'>FR</MenuItem>
              <MenuItem value='es'>ES</MenuItem>
              <MenuItem value='pt'>PT</MenuItem>
              <MenuItem value='de'>DE</MenuItem>
              <MenuItem value='nl'>NL</MenuItem>
            </Select>
          </FormControl>

          <Box
            onClick={() => { toggleDarkMode(); toggleDrawer(); }}
            sx={{
              width: 52,
              height: 28,
              backgroundColor: darkMode ? '#2a2a4a' : '#E9ECF2',
              borderRadius: 999,
              display: 'flex',
              alignItems: 'center',
              justifyContent: darkMode ? 'flex-end' : 'flex-start',
              px: '3px',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
            }}
          >
            <Box
              sx={{
                width: 22,
                height: 22,
                backgroundColor: '#0004FF',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                transition: 'all 0.3s ease',
              }}
            >
              {darkMode ? <BedtimeIcon sx={{ fontSize: 13 }} /> : <WbSunnyIcon sx={{ fontSize: 13 }} />}
            </Box>
          </Box>
        </Stack>
      </Drawer>
    </>
  );
};

export default Header;
