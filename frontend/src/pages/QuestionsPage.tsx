import React, { useState, useEffect } from 'react';
import { Box, Paper, Typography } from '@mui/material';
import { useParams } from 'react-router-dom';
import { getSegmenti, Segment, Vprasanje, Odgovor } from '../api/api';
import SegmentQuestions from '../components/SegmentQuestions';

const QuestionsPage: React.FC = () => {
  const { segmentId } = useParams<{ segmentId: string }>();
  const [segment, setSegment] = useState<Segment | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [odgovori, setOdgovori] = useState<{ [key: number]: Odgovor }>({});

  useEffect(() => {
    const fetchSegment = async () => {
      try {
        if (!segmentId) return;
        const data = await getSegmenti(1, "1");
        const foundSegment = data.find((s: Segment) => s.id === parseInt(segmentId));
        if (foundSegment) {
          setSegment(foundSegment);
        } else {
          setError('Segment ni najden');
        }
      } catch (err) {
        setError('Napaka pri nalaganju segmenta');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchSegment();
  }, [segmentId]);

  const handleOdgovorChange = (vprasanjeId: number, odgovor: string) => {
    setOdgovori(prev => ({
      ...prev,
      [vprasanjeId]: {
        vprasanje_id: vprasanjeId,
        odgovor,
        projekt_id: 1, // TODO: Pridobi iz konteksta ali parametrov
        serijska_stevilka: "1" // TODO: Pridobi iz konteksta ali parametrov
      }
    }));
  };

  if (loading) return <Typography>Nalaganje...</Typography>;
  if (error) return <Typography color="error">{error}</Typography>;
  if (!segment) return <Typography>Segment ni najden</Typography>;

  return (
    <Box sx={{ p: 3 }}>
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h4" gutterBottom>
          {segment.ime}
        </Typography>
        <SegmentQuestions
          segmentId={segment.id}
          segmentNaziv={segment.ime}
          vprasanja={segment.vprasanja}
          odgovori={odgovori}
          onOdgovorChange={handleOdgovorChange}
          projektId={1} // TODO: Pridobi iz konteksta ali parametrov
          serijskaStevilka="1" // TODO: Pridobi iz konteksta ali parametrov
        />
      </Paper>
    </Box>
  );
};

export default QuestionsPage; 