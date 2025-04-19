import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  Grid,
  MenuItem,
  Alert,
} from '@mui/material';
import { useAuth } from '../context/AuthContext';
import { getTipi } from '../api/api';

interface Tip {
  id: number;
  naziv: string;
}

const ChecklistStart: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [tipi, setTipi] = useState<Tip[]>([]);
  const [selectedTip, setSelectedTip] = useState<number | ''>('');
  const [stevilkaProjekta, setStevilkaProjekta] = useState('');
  const [steviloPonovitev, setSteviloPonovitev] = useState(1);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchTipi = async () => {
      try {
        const response = await getTipi();
        setTipi(response);
      } catch (error) {
        setError('Napaka pri nalaganju tipov');
      }
    };
    fetchTipi();
  }, []);

  const handleStartNew = () => {
    if (!selectedTip || !stevilkaProjekta) {
      setError('Prosim izberite tip in vnesite številko projekta');
      return;
    }
    navigate(`/checklist/new/${selectedTip}/${stevilkaProjekta}/${steviloPonovitev}`);
  };

  const handleOpenExisting = () => {
    navigate('/checklist/list');
  };

  return (
    <Box sx={{ p: 3, maxWidth: 800, margin: '0 auto' }}>
      <Paper elevation={3} sx={{ p: 3 }}>
        <Typography variant="h4" gutterBottom>
          Kontrolni Seznam
        </Typography>
        
        <Typography variant="subtitle1" gutterBottom>
          Osebna številka: {user?.osebna_stevilka}
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <Grid container spacing={3}>
          <Grid item xs={12}>
            <TextField
              fullWidth
              label="Številka projekta"
              value={stevilkaProjekta}
              onChange={(e) => setStevilkaProjekta(e.target.value)}
              required
            />
          </Grid>

          <Grid item xs={12}>
            <TextField
              fullWidth
              select
              label="Tip"
              value={selectedTip}
              onChange={(e) => setSelectedTip(Number(e.target.value))}
              required
            >
              {tipi.map((tip) => (
                <MenuItem key={tip.id} value={tip.id}>
                  {tip.naziv}
                </MenuItem>
              ))}
            </TextField>
          </Grid>

          <Grid item xs={12}>
            <TextField
              fullWidth
              type="number"
              label="Število ponovitev"
              value={steviloPonovitev}
              onChange={(e) => setSteviloPonovitev(Number(e.target.value))}
              inputProps={{ min: 1 }}
            />
          </Grid>

          <Grid item xs={12} sm={6}>
            <Button
              fullWidth
              variant="contained"
              color="primary"
              onClick={handleStartNew}
            >
              Začni Nov Seznam
            </Button>
          </Grid>

          <Grid item xs={12} sm={6}>
            <Button
              fullWidth
              variant="outlined"
              color="primary"
              onClick={handleOpenExisting}
            >
              Odpri Obstojec Seznam
            </Button>
          </Grid>
        </Grid>
      </Paper>
    </Box>
  );
};

export default ChecklistStart; 