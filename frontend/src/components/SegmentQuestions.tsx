import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  FormControl,
  FormControlLabel,
  Radio,
  RadioGroup,
  CircularProgress,
  Alert,
  Grid,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  Check as CheckIcon,
  Close as CloseIcon,
  Help as HelpIcon,
} from '@mui/icons-material';
import { saveOdgovor } from '../api/api';

interface Vprasanje {
  id: number;
  vprasanje: string;
  tip: string;
  repeatability: boolean;
  obvezno: boolean;
  moznosti: string;
}

interface Odgovor {
  id?: number;
  vprasanje_id: number;
  odgovor: string;
}

interface SegmentQuestionsProps {
  segmentId: number;
  segmentNaziv: string;
  vprasanja: Vprasanje[];
  odgovori: { [key: number]: Odgovor };
  onOdgovorChange: (vprasanjeId: number, odgovor: string) => void;
  projektId: number;
  serijskaStevilka: string;
}

const SegmentQuestions: React.FC<SegmentQuestionsProps> = ({
  segmentId,
  segmentNaziv,
  vprasanja,
  odgovori,
  onOdgovorChange,
  projektId,
  serijskaStevilka,
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleMassInput = (value: string) => {
    vprasanja.forEach((v) => {
      if (v.tip === 'multiple_choice') {
        onOdgovorChange(v.id, value);
      }
    });
  };

  const handleSave = async () => {
    try {
      setLoading(true);
      setError(null);
      setSuccess(null);

      // Shranimo vse odgovore
      for (const vprasanje of vprasanja) {
        const odgovor = odgovori[vprasanje.id];
        if (odgovor) {
          await saveOdgovor({
            vprasanje_id: vprasanje.id,
            odgovor: odgovor.odgovor,
            projekt_id: projektId,
            serijska_stevilka: serijskaStevilka,
          });
        }
      }

      setSuccess('Odgovori uspešno shranjeni');
    } catch (err) {
      setError('Napaka pri shranjevanju odgovorov');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Paper elevation={3} sx={{ p: 3, mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h5" component="h2">
            {segmentNaziv}
          </Typography>
          <Box>
            <Button
              variant="contained"
              color="success"
              onClick={() => handleMassInput('Da')}
              sx={{ mr: 1 }}
            >
              VSI DA
            </Button>
            <Button
              variant="contained"
              color="error"
              onClick={() => handleMassInput('Ne')}
              sx={{ mr: 1 }}
            >
              VSI NE
            </Button>
            <Button
              variant="contained"
              color="warning"
              onClick={() => handleMassInput('n/a')}
            >
              VSI N/A
            </Button>
          </Box>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {success && (
          <Alert severity="success" sx={{ mb: 2 }}>
            {success}
          </Alert>
        )}

        <Grid container spacing={3}>
          {vprasanja.map((v) => (
            <Grid item xs={12} key={v.id}>
              <Paper elevation={1} sx={{ p: 2 }}>
                <FormControl component="fieldset">
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                    <Typography variant="subtitle1" sx={{ flexGrow: 1 }}>
                      {v.vprasanje}
                    </Typography>
                    {v.obvezno && (
                      <Tooltip title="Obvezno vprašanje">
                        <IconButton size="small" color="error">
                          <HelpIcon />
                        </IconButton>
                      </Tooltip>
                    )}
                  </Box>
                  <RadioGroup
                    value={odgovori[v.id]?.odgovor || ''}
                    onChange={(e) => onOdgovorChange(v.id, e.target.value)}
                    row
                  >
                    <FormControlLabel
                      value="Da"
                      control={<Radio color="success" />}
                      label="Da"
                    />
                    <FormControlLabel
                      value="Ne"
                      control={<Radio color="error" />}
                      label="Ne"
                    />
                    <FormControlLabel
                      value="n/a"
                      control={<Radio color="warning" />}
                      label="N/A"
                    />
                  </RadioGroup>
                </FormControl>
              </Paper>
            </Grid>
          ))}
        </Grid>

        <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
          <Button
            variant="contained"
            color="primary"
            onClick={handleSave}
            disabled={loading}
            startIcon={loading ? <CircularProgress size={20} /> : <CheckIcon />}
          >
            Shrani napredek
          </Button>
        </Box>
      </Paper>
    </Box>
  );
};

export default SegmentQuestions; 