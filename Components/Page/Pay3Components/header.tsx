'use client';

import { useState } from 'react';
import Image from 'next/image';
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
  Avatar,
  Badge,
  Button,
  useMediaQuery,
  useTheme
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import WbSunnyIcon from '@mui/icons-material/WbSunny';
import BedtimeIcon from '@mui/icons-material/Bedtime';
import Notification from "@/assets/Icons/Nitification";
import User from '@/assets/Images/user.png';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
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

  const toggleDrawer = () => {
    setDrawerOpen(!drawerOpen);
  };

  const [open, setOpen] = useState(false);

  const handleLanguageChange = (event: any) => {
    const newLocale = event.target.value as string;
    // Set cookie to remember user's language preference
    document.cookie = `NEXT_LOCALE=${newLocale}; path=/; max-age=31536000; SameSite=Lax`;
    const { pathname, asPath, query } = router;
    // Use replace instead of push to avoid adding to history stack
    // State is preserved via sessionStorage (handled in payment components)
    router.replace({ pathname, query }, asPath, { locale: newLocale });
  };

  return (
    <>
      <AppBar
        position='static'
        sx={{
          backgroundImage: `url('/wave.png'), linear-gradient(90deg, #101EF7 0%, #4B50E6 50%, #7C5CF0 100%)`,
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'top right',
          backgroundSize: 'auto',
          padding: '0.5rem 1rem',
          boxShadow: 'none',
          height: '92px'
        }}
      >
        <Toolbar sx={{ justifyContent: 'space-between', height: '100%' }}>
          {/* Left: Logo */}
          <Box display='flex' alignItems='center' gap={1}>
            <Logo width={50} height={60} />
          </Box>

          {/* Right: Menu or Full Actions */}
          {isMobile ? (
            <IconButton data-testid="mobile-menu-button" onClick={toggleDrawer} sx={{ color: 'white' }}>
              <MenuIcon />
            </IconButton>
          ) : (
            <Stack direction='row' spacing={3} alignItems='center'>
              <Button
                startIcon={<Icon icon="solar:wallet-linear" width="24" height="24" />}
                variant='contained'
                sx={{
                  backgroundColor: '#FFF',
                  color: '#444CE7',
                  borderRadius: 20,
                  px: 2,
                  py: 2,
                  right: { md: "30%", lg: "60%", xl: "100%" },
                  textTransform: 'none',
                  fontSize: '14px',
                  fontFamily: "Space Grotesk",
                  fontWeight: '500',
                  boxShadow: 'none',
                  '&:hover': {
                    backgroundColor: '#f5f5f5'
                  },
                  height: '44px'
                }}
              >
                {t('header.wallet')}
              </Button>

              <FormControl variant="standard">
                <Select
                  data-testid="language-selector"
                  value={router.locale || 'en'}
                  onChange={handleLanguageChange}
                  onOpen={() => setOpen(true)}
                  onClose={() => setOpen(false)}
                  disableUnderline
                  IconComponent={() => (
                    <KeyboardArrowDownIcon
                      sx={{
                        color: 'white',
                        transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
                        transition: 'transform 0.3s ease',
                      }}
                    />
                  )}
                  sx={{
                    color: 'white',
                    fontFamily: 'Space Grotesk',
                    fontWeight: 600,
                    '& .MuiSelect-icon': {
                      right: 8,
                    },
                  }}
                  MenuProps={{
                    PaperProps: {
                      'data-testid': 'language-menu',
                      sx: {
                        mt: 1,
                        borderRadius: 2,
                      }
                    }
                  }}
                >
                  <MenuItem data-testid="lang-en" value="en">EN</MenuItem>
                  <MenuItem data-testid="lang-fr" value="fr">FR</MenuItem>
                  <MenuItem data-testid="lang-es" value="es">ES</MenuItem>
                  <MenuItem data-testid="lang-pt" value="pt">PT</MenuItem>
                  <MenuItem data-testid="lang-de" value="de">DE</MenuItem>
                  <MenuItem data-testid="lang-nl" value="nl">NL</MenuItem>
                </Select>
              </FormControl>

              {/* Theme Toggle */}
              <Box
                data-testid="theme-toggle"
                onClick={toggleDarkMode}
                sx={{
                  width: 80,
                  height: 40,
                  backgroundColor: 'white',
                  borderRadius: 999,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  px: 0.5,
                  cursor: 'pointer',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                  transition: 'all 0.3s ease'
                }}
              >
                <Box
                  sx={{
                    width: 32,
                    height: 32,
                    backgroundColor: !darkMode ? '#444CE7' : '#fff',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    color: 'white',
                    transition: 'all 0.3s ease',
                    padding: '4px'

                  }}
                >
                  <WbSunnyIcon fontSize='small' sx={{
                    color: darkMode ? '#444CE7' : '#fff',
                    width: '100%'
                  }} />
                </Box>
                <Box
                  sx={{
                    width: 32,
                    height: 32,
                    backgroundColor: darkMode ? '#444CE7' : '#fff',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    color: 'white',
                    transition: 'all 0.3s ease',
                    padding: '4px'
                  }}
                >
                  <BedtimeIcon sx={{
                    color: darkMode ? '#fff' : '#444CE7',
                    width: '100%'
                  }} fontSize='small' />
                </Box>
              </Box>

              {/* Notifications */}
              <IconButton sx={{ color: 'white', position: 'relative', }}>
                <Badge
                  variant="dot"
                  sx={{
                    position: 'absolute',
                    top: 18,
                    right: 18,
                    '& .MuiBadge-dot': {
                      height: 11,
                      width: 11,
                      backgroundColor: '#444CE7',
                    },
                  }}
                >
                </Badge>
                <Notification />

              </IconButton>

              {/* Avatar */}
              <Box position='relative'>
                <Avatar
                  sx={{ bgcolor: 'white', color: '#2b3bcf', width: 48, height: 48 }}
                >
                  <Image src={User.src} alt='User' width={28} height={28} />
                </Avatar>
                <Box
                  sx={{
                    position: 'absolute',
                    bottom: 4,
                    right: 2,
                    width: 12,
                    height: 12,
                    borderRadius: '50%',
                    backgroundColor: '#12B76A',
                    border: '2px solid white'
                  }}
                />
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
        ModalProps={{
          keepMounted: true, // Better mobile performance
        }}
        sx={{
          '& .MuiDrawer-paper': {
            zIndex: 1200,
          }
        }}
      >
        <Box sx={{ width: 250, p: 2 }}>
          <Stack spacing={2}>
            <Button startIcon={<AccountBalanceWalletIcon />}>{t('header.wallet')}</Button>
            <FormControl variant='standard' sx={{ minWidth: 120 }}>
              <Select 
                data-testid="language-selector-mobile"
                value={router.locale || 'en'}
                onChange={(e) => {
                  handleLanguageChange(e);
                  toggleDrawer(); // Close drawer after selection
                }}
                MenuProps={{
                  disablePortal: false,
                  sx: { 
                    zIndex: 1500, // Higher than drawer (1200)
                    '& .MuiPaper-root': {
                      zIndex: 1500,
                    }
                  }
                }}
              >
                <MenuItem data-testid="lang-mobile-en" value='en'>EN</MenuItem>
                <MenuItem data-testid="lang-mobile-fr" value='fr'>FR</MenuItem>
                <MenuItem data-testid="lang-mobile-es" value='es'>ES</MenuItem>
                <MenuItem data-testid="lang-mobile-pt" value='pt'>PT</MenuItem>
                <MenuItem data-testid="lang-mobile-de" value='de'>DE</MenuItem>
                <MenuItem data-testid="lang-mobile-nl" value='nl'>NL</MenuItem>
              </Select>
            </FormControl>
            <Box
              data-testid="theme-toggle-mobile"
              onClick={toggleDarkMode}
              sx={{
                width: 60,
                height: 30,
                backgroundColor: 'white',
                borderRadius: 999,
                display: 'flex',
                alignItems: 'center',
                justifyContent: darkMode ? 'flex-end' : 'flex-start',
                px: 0.5,
                cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                transition: 'all 0.3s ease'
              }}
            >
              <Box
                sx={{
                  width: 24,
                  height: 24,
                  backgroundColor: '#444CE7',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white',
                  transition: 'all 0.3s ease'
                }}
              >
                {darkMode ? <WbSunnyIcon fontSize='small' /> : <BedtimeIcon fontSize='small' />}
              </Box>
            </Box>
          </Stack>
        </Box>
      </Drawer>
    </>
  );
};

export default Header;
