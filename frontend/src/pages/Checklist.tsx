import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Paper,
  Typography,
  Container,
  Button,
  ButtonGroup,
  Divider,
  TextField,
  useTheme,
  useMediaQuery,
  IconButton,
  Drawer,
  List,
  ListItem,
  ListItemText,
  Tooltip,
  Fab,
  CircularProgress,
  Alert,
  SpeedDial,
  SpeedDialIcon,
  SpeedDialAction,
} from '@mui/material';
import {
  getVprasanja,
  getSegmenti,
  saveOdgovor,
  getOdgovori,
  Vprasanje,
  Segment,
  Odgovor,
  createSerijskaStevilka,
  getProjekt,
  Projekt,
  SerijskaStevilka,
  getSerijskeStevilke,
  exportToXlsx,
  exportToPdf,
  createProjekt,
  saveOdgovori,
} from '../api/api';
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import SaveIcon from '@mui/icons-material/Save';
import MenuIcon from '@mui/icons-material/Menu';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import axios from 'axios';

const Checklist: React.FC = () => {
  const { projektId = '', tipId = '1', ponovitve = '3' } = useParams<{
    projektId?: string;
    tipId?: string;
    ponovitve?: string;
  }>();
  const navigate = useNavigate();
  
  const [activeStep, setActiveStep] = useState(0);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [questions, setQuestions] = useState<Vprasanje[]>([]);
  const [answers, setAnswers] = useState<{ [key: string]: string }>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [serijskeStevilke, setSerijskeStevilke] = useState<SerijskaStevilka[]>([]);
  const [projekt, setProjekt] = useState<Projekt | null>(null);
  const [stPonovitev, setStPonovitev] = useState<number>(parseInt(ponovitve));
  const [snackbarMessage, setSnackbarMessage] = useState<string>('');
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [isAtTop, setIsAtTop] = useState(true);

  useEffect(() => {
    const initializeChecklist = async () => {
      try {
        setLoading(true);
        setError(null);

        // Najprej pridobimo projekt
        let projektData;
        try {
          projektData = await getProjekt(projektId);
          setProjekt(projektData);
        } catch (error) {
          if (axios.isAxiosError(error) && error.response?.status === 404) {
            setError('Projekt ne obstaja. Ustvarite nov projekt.');
            return;
          }
          throw error;
        }
        
        // Nastavimo število ponovitev iz projekta
        if (projektData.projekt_tipi && projektData.projekt_tipi.length > 0) {
          const tipPonovitev = projektData.projekt_tipi.find(pt => pt.tip === parseInt(tipId));
          if (tipPonovitev) {
            setStPonovitev(tipPonovitev.stevilo_ponovitev);
          }
        }
        
        // Pridobi segmente in vprašanja
        const [segmentiData, vprasanjaData] = await Promise.all([
          getSegmenti(parseInt(tipId), projektId),
          getVprasanja(parseInt(tipId), projektId)
        ]);
        
        setSegments(segmentiData);
        setQuestions(vprasanjaData);
        
        // Pridobi ali ustvari serijske številke
        const existingSerijskeStevilke = await getSerijskeStevilke(projektId, parseInt(tipId));
        if (existingSerijskeStevilke.length === 0) {
          // Ustvari nove serijske številke
          const newSerijskeStevilke = await Promise.all(
            Array.from({ length: stPonovitev }, (_, index) =>
              createSerijskaStevilka(projektId, parseInt(tipId), index)
            )
          );
          setSerijskeStevilke(newSerijskeStevilke);
          setAnswers({});
        } else {
          setSerijskeStevilke(existingSerijskeStevilke);
          
          // Naloži obstoječe odgovore za vse serijske številke
          const allAnswers: { [key: string]: string } = {};
          const odgovoriPromises = existingSerijskeStevilke.map(stevilka => 
            getOdgovori(stevilka.id)
          );
          
          const odgovoriResults = await Promise.all(odgovoriPromises);
          odgovoriResults.forEach((odgovori, index) => {
            const stevilka = existingSerijskeStevilke[index];
            odgovori.forEach(odgovor => {
              const odgovorKey = `${odgovor.vprasanje_id}-${stevilka.stevilka}`;
              allAnswers[odgovorKey] = odgovor.odgovor;
            });
          });
          
          setAnswers(allAnswers);
        }
      } catch (err) {
        setError('Napaka pri nalaganju podatkov: ' + (err instanceof Error ? err.message : String(err)));
      } finally {
        setLoading(false);
      }
    };

    initializeChecklist();
  }, [projektId, tipId]);

  useEffect(() => {
    const handleScroll = () => {
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
      setIsAtTop(scrollTop < 100); // 100px toleranca
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const getCurrentSegmentVprasanja = () => {
    if (!segments || activeStep === null) return [];
    const currentSegment = segments[activeStep];
    return questions.filter(q => q.segment === currentSegment.id);
  };

  const handleNext = () => {
    setActiveStep((prevStep) => prevStep + 1);
    // Premik na vrh strani z gladko animacijo
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleBack = () => {
    setActiveStep((prevStep) => prevStep - 1);
    // Premik na vrh strani z gladko animacijo
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const showMessage = (message: string) => {
    setSnackbarMessage(message);
    setSnackbarOpen(true);
  };

  const handleCloseSnackbar = () => {
    setSnackbarOpen(false);
  };

  const handleSaveOdgovor = async (vprasanje: Vprasanje, odgovor: string, serijskaStevilka: SerijskaStevilka) => {
    if (!projektId || !serijskaStevilka) return;
    
    try {
      // Posodobi lokalno stanje
      const odgovorKey = `${vprasanje.id}-${serijskaStevilka.stevilka}`;
      setAnswers(prev => ({ ...prev, [odgovorKey]: odgovor }));
      
      // Shrani na strežnik
      await saveOdgovor({
        vprasanje_id: vprasanje.id,
        odgovor,
        projekt_id: parseInt(projektId),
        serijska_stevilka: serijskaStevilka.stevilka
      });
      
      toast.success('Odgovor uspešno shranjen');
    } catch (err) {
      console.error('Napaka pri shranjevanju odgovora:', err);
      toast.error('Napaka pri shranjevanju odgovora');
    }
  };

  const handleMasovniOdgovor = async (vprasanjeId: number, value: string) => {
    try {
      // Posodobi lokalno stanje
      const odgovori = serijskeStevilke.map(stevilka => {
        const odgovorKey = `${vprasanjeId}-${stevilka.stevilka}`;
        setAnswers(prev => ({ ...prev, [odgovorKey]: value }));
        
        return {
          vprasanje_id: vprasanjeId,
          odgovor: value,
          projekt_id: parseInt(projektId),
          serijska_stevilka: stevilka.stevilka
        };
      });
      
      // Shrani vse odgovore naenkrat
      await saveOdgovori(odgovori);
      toast.success('Vsi odgovori uspešno shranjeni');
    } catch (err) {
      console.error('Napaka pri masovnem shranjevanju:', err);
      toast.error('Napaka pri masovnem shranjevanju odgovorov');
    }
  };

  const handleShraniOdgovore = async () => {
    try {
      const vprasanja = getCurrentSegmentVprasanja();
      const promises: Promise<any>[] = [];

      // Za vsako vprašanje v trenutnem segmentu
      for (const vprasanje of vprasanja) {
        // Za vsako serijsko številko
        for (const stevilka of serijskeStevilke) {
          const odgovorKey = `${vprasanje.id}-${stevilka.stevilka}`;
          const odgovor = answers[odgovorKey];
          
          // Če obstaja odgovor, ga shrani
          if (odgovor !== undefined) {
            promises.push(saveOdgovor({
              vprasanje_id: vprasanje.id,
              odgovor: odgovor,
              projekt_id: parseInt(projektId),
              serijska_stevilka: stevilka.stevilka
            }));
          }
        }
      }

      await Promise.all(promises);
      toast.success('Odgovori uspešno shranjeni');
    } catch (error) {
      console.error('Napaka pri shranjevanju odgovorov:', error);
      toast.error('Napaka pri shranjevanju odgovorov');
    }
  };

  const handleExportXlsx = async () => {
    try {
      const blob = await exportToXlsx(projektId);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `projekt_${projektId}_odgovori.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success('Izvoz uspešno zaključen');
    } catch (error) {
      console.error('Napaka pri izvozu:', error);
      toast.error('Napaka pri izvozu datoteke');
    }
  };

  const handleExportPdf = async () => {
    try {
      const blob = await exportToPdf(projektId);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `projekt_${projektId}_odgovori.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success('PDF izvoz uspešno zaključen');
    } catch (error) {
      console.error('Napaka pri izvozu PDF:', error);
      toast.error('Napaka pri izvozu PDF datoteke');
    }
  };

  const renderSegmentNavigation = () => {
    const navigationContent = (
      <>
        <Typography variant="h6" gutterBottom>
          Segmenti
        </Typography>
        <List>
          {segments.map((segment, index) => {
            const isVisible = Math.abs(index - activeStep) <= 2;
            if (!isVisible && !isMobile) return null;

            return (
              <ListItem 
                key={segment.id}
                button
                selected={index === activeStep}
                onClick={() => {
                  setActiveStep(index);
                  if (isMobile) setDrawerOpen(false);
                }}
                sx={{
                  mb: 1,
                  bgcolor: index === activeStep ? 'primary.main' : 'transparent',
                  color: index === activeStep ? 'primary.contrastText' : 'text.primary',
                  '&:hover': {
                    bgcolor: index === activeStep ? 'primary.dark' : 'action.hover',
                  },
                }}
              >
                <ListItemText 
                  primary={`${index + 1}. ${segment.naziv}`}
                  primaryTypographyProps={{
                    style: { 
                      whiteSpace: 'normal',
                      wordBreak: 'break-word'
                    }
                  }}
                />
              </ListItem>
            );
          })}
        </List>
      </>
    );

    if (isMobile) {
      return (
        <>
          <Tooltip title="Navigacija">
            <Fab
              size="medium"
              color="primary"
              aria-label="menu"
              onClick={() => setDrawerOpen(true)}
              sx={{
                position: 'fixed',
                top: isAtTop ? 72 : 16,
                left: 16,
                zIndex: 1000,
                transition: 'top 0.3s ease'
              }}
            >
              <MenuIcon />
            </Fab>
          </Tooltip>
          <Drawer
            anchor="left"
            open={drawerOpen}
            onClose={() => setDrawerOpen(false)}
          >
            <Box sx={{ width: 250, p: 2 }}>
              {navigationContent}
            </Box>
          </Drawer>
        </>
      );
    }

    return (
      <Paper 
        elevation={3} 
        sx={{ 
          width: 250,
          maxHeight: '70vh',
          overflowY: 'auto',
          p: 2,
          position: 'sticky',
          top: 24,
          display: { xs: 'none', sm: 'block' }
        }}
      >
        {navigationContent}
      </Paper>
    );
  };

  if (loading) {
    return (
      <Container maxWidth="lg">
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  if (error) {
    return (
      <Container maxWidth="lg">
        <Alert severity="error" sx={{ mt: 4 }}>{error}</Alert>
        <Box sx={{ mt: 2, display: 'flex', justifyContent: 'center', gap: 2 }}>
          <Button variant="contained" onClick={() => navigate('/')}>
            Nazaj na začetek
          </Button>
          {error.includes('ne obstaja') && (
            <Button 
              variant="contained" 
              color="primary"
              onClick={() => {
                createProjekt({
                  id: projektId,
                  osebna_stevilka: localStorage.getItem('osebna_stevilka') || '1',
                  datum: new Date().toISOString().split('T')[0],
                  projekt_tipi: [{
                    tip: parseInt(tipId),
                    stevilo_ponovitev: parseInt(ponovitve)
                  }]
                }).then(() => {
                  window.location.reload();
                }).catch(err => {
                  setError('Napaka pri ustvarjanju projekta: ' + err.message);
                });
              }}
            >
              Ustvari nov projekt
            </Button>
          )}
        </Box>
      </Container>
    );
  }

  if (!projekt) {
    return (
      <Container maxWidth="lg">
        <Alert severity="warning" sx={{ mt: 4 }}>
          Projekt ni na voljo. Prosim, preverite številko projekta.
        </Alert>
        <Box sx={{ mt: 2, display: 'flex', justifyContent: 'center' }}>
          <Button variant="contained" onClick={() => navigate('/')}>
            Nazaj na začetek
          </Button>
        </Box>
      </Container>
    );
  }

  return (
    <Box sx={{ p: isMobile ? 2 : 3, position: 'relative', minHeight: '100vh' }}>
      <Container maxWidth="lg">
        <Box sx={{ mt: 2, mb: 4 }}>
          <Typography variant="h4" component="h1" gutterBottom align="center">
            Kontrolni seznam
          </Typography>
          
          <Typography variant="subtitle1" gutterBottom align="center">
            Projekt: {projekt?.id} - Število ponovitev: {stPonovitev}
          </Typography>
          
          <Box sx={{ display: 'flex', gap: 2, flexDirection: isMobile ? 'column' : 'row' }}>
            {renderSegmentNavigation()}

            {/* Vsebina segmenta */}
            <Paper elevation={3} sx={{ flex: 1, p: isMobile ? 2 : 4 }}>
              {segments[activeStep] && (
                <>
                  <Typography variant="h5" gutterBottom>
                    {segments[activeStep].naziv}
                  </Typography>
                  
                  {getCurrentSegmentVprasanja().map((vprasanje) => (
                    <Box key={vprasanje.id} sx={{ mb: 3 }}>
                      <Box sx={{ mb: 2 }}>
                        <Typography 
                          variant={isMobile ? "body1" : "subtitle1"} 
                          gutterBottom
                          sx={{ fontWeight: 'medium' }}
                        >
                          {vprasanje.vprasanje}
                        </Typography>
                        <ButtonGroup 
                          variant="contained" 
                          size={isMobile ? "large" : "small"}
                          fullWidth={isMobile}
                          sx={{ mb: 1 }}
                        >
                          <Button 
                            onClick={() => handleMasovniOdgovor(vprasanje.id, 'Da')}
                            color="success"
                            sx={{ flex: 1 }}
                          >
                            Vsi DA
                          </Button>
                          <Button 
                            onClick={() => handleMasovniOdgovor(vprasanje.id, 'Ne')}
                            color="error"
                            sx={{ flex: 1 }}
                          >
                            Vsi NE
                          </Button>
                          <Button 
                            onClick={() => handleMasovniOdgovor(vprasanje.id, 'n/a')}
                            color="warning"
                            sx={{ flex: 1 }}
                          >
                            Vsi N/A
                          </Button>
                        </ButtonGroup>
                        <TextField
                          size={isMobile ? "medium" : "small"}
                          fullWidth
                          placeholder="Vnesite besedilo za vse ponovitve"
                          sx={{ mt: 1 }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              handleMasovniOdgovor(vprasanje.id, (e.target as HTMLInputElement).value);
                              (e.target as HTMLInputElement).value = '';
                            }
                          }}
                        />
                      </Box>
                      
                      {serijskeStevilke.map((stevilka) => (
                        <Box 
                          key={stevilka.id} 
                          sx={{ 
                            mb: 2, 
                            p: isMobile ? 1.5 : 2, 
                            border: '1px solid #e0e0e0', 
                            borderRadius: 1,
                            backgroundColor: '#fafafa'
                          }}
                        >
                          <Typography variant="subtitle2" color="textSecondary" gutterBottom>
                            Ponovitev {stevilka.stevilka.split('-')[2]} od {stPonovitev}
                          </Typography>
                          <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
                            <Button
                              size={isMobile ? "large" : "small"}
                              variant={answers[`${vprasanje.id}-${stevilka.stevilka}`] === 'Da' ? 'contained' : 'outlined'}
                              color="success"
                              onClick={() => handleSaveOdgovor(vprasanje, 'Da', stevilka)}
                              fullWidth={isMobile}
                            >
                              DA
                            </Button>
                            <Button
                              size={isMobile ? "large" : "small"}
                              variant={answers[`${vprasanje.id}-${stevilka.stevilka}`] === 'Ne' ? 'contained' : 'outlined'}
                              color="error"
                              onClick={() => handleSaveOdgovor(vprasanje, 'Ne', stevilka)}
                              fullWidth={isMobile}
                            >
                              NE
                            </Button>
                            <Button
                              size={isMobile ? "large" : "small"}
                              variant={answers[`${vprasanje.id}-${stevilka.stevilka}`] === 'n/a' ? 'contained' : 'outlined'}
                              color="warning"
                              onClick={() => handleSaveOdgovor(vprasanje, 'n/a', stevilka)}
                              fullWidth={isMobile}
                            >
                              N/A
                            </Button>
                          </Box>
                          <TextField
                            size={isMobile ? "medium" : "small"}
                            value={answers[`${vprasanje.id}-${stevilka.stevilka}`] || ''}
                            onChange={(e) => handleSaveOdgovor(vprasanje, e.target.value, stevilka)}
                            fullWidth
                            required={vprasanje.obvezno}
                            placeholder="Vpišite odgovor ali uporabite gumbe zgoraj"
                          />
                        </Box>
                      ))}
                      <Divider sx={{ my: 2 }} />
                    </Box>
                  ))}

                  <Box sx={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    mt: 4,
                    gap: 2,
                    flexDirection: isMobile ? 'column' : 'row'
                  }}>
                    <Button
                      onClick={handleBack}
                      disabled={activeStep === 0}
                      fullWidth={isMobile}
                      size={isMobile ? "large" : "medium"}
                    >
                      Nazaj
                    </Button>
                    <Button
                      variant="contained"
                      onClick={activeStep === segments.length - 1 ? () => navigate('/') : handleNext}
                      fullWidth={isMobile}
                      size={isMobile ? "large" : "medium"}
                    >
                      {activeStep === segments.length - 1 ? 'Zaključi' : 'Naprej'}
                    </Button>
                  </Box>
                </>
              )}
            </Paper>
          </Box>
        </Box>
      </Container>

      {/* Plavajoči gumbi */}
      <SpeedDial
        ariaLabel="SpeedDial"
        sx={{ position: 'fixed', bottom: 24, right: 24 }}
        icon={<SpeedDialIcon />}
      >
        <SpeedDialAction
          icon={<SaveIcon />}
          tooltipTitle="Shrani odgovore"
          onClick={handleShraniOdgovore}
        />
        <SpeedDialAction
          icon={<FileDownloadIcon />}
          tooltipTitle="Izvozi v Excel"
          onClick={handleExportXlsx}
        />
        <SpeedDialAction
          icon={<PictureAsPdfIcon />}
          tooltipTitle="Izvozi v PDF"
          onClick={handleExportPdf}
        />
      </SpeedDial>
    </Box>
  );
};

export default Checklist;