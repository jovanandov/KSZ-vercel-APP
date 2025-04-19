import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Checkbox,
  IconButton,
  TextField,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import { ChecklistContext, useChecklist } from '../context/ChecklistContext';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';

const Seznam: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { checklists, updateChecklist } = useChecklist();
  const [notesDialogOpen, setNotesDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<number | null>(null);
  const [notes, setNotes] = useState('');

  const checklist = checklists.find(c => c.id === Number(id));

  if (!checklist) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
        <Typography color="error">Seznam ni najden</Typography>
      </Box>
    );
  }

  const handleToggle = async (itemId: number) => {
    const updatedItems = checklist.items.map(item =>
      item.id === itemId ? { ...item, completed: !item.completed } : item
    );

    await updateChecklist(checklist.id, { items: updatedItems });
  };

  const handleNotesClick = (itemId: number) => {
    const item = checklist.items.find(i => i.id === itemId);
    if (item) {
      setSelectedItem(itemId);
      setNotes(item.notes);
      setNotesDialogOpen(true);
    }
  };

  const handleNotesSave = async () => {
    if (selectedItem === null) return;

    const updatedItems = checklist.items.map(item =>
      item.id === selectedItem ? { ...item, notes } : item
    );

    await updateChecklist(checklist.id, { items: updatedItems });
    setNotesDialogOpen(false);
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 4 }}>
        <IconButton onClick={() => navigate('/')} sx={{ mr: 2 }}>
          <ArrowBackIcon />
        </IconButton>
        <Typography variant="h4">{checklist.title}</Typography>
      </Box>

      <List>
        {checklist.items.map((item) => (
          <ListItem
            key={item.id}
            sx={{
              bgcolor: item.completed ? 'action.selected' : 'background.paper',
              mb: 1,
              borderRadius: 1,
            }}
          >
            <Checkbox
              edge="start"
              checked={item.completed}
              onChange={() => handleToggle(item.id)}
            />
            <ListItemText
              primary={item.text}
              secondary={item.notes}
              sx={{
                textDecoration: item.completed ? 'line-through' : 'none',
                color: item.completed ? 'text.secondary' : 'text.primary',
              }}
            />
            <ListItemSecondaryAction>
              <IconButton
                edge="end"
                onClick={() => handleNotesClick(item.id)}
                sx={{ mr: 1 }}
              >
                <EditIcon />
              </IconButton>
              <IconButton
                edge="end"
                onClick={() => navigate(`/urejanje/${checklist.id}`)}
              >
                <DeleteIcon />
              </IconButton>
            </ListItemSecondaryAction>
          </ListItem>
        ))}
      </List>

      <Dialog open={notesDialogOpen} onClose={() => setNotesDialogOpen(false)}>
        <DialogTitle>Opombe</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Opombe"
            fullWidth
            multiline
            rows={4}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setNotesDialogOpen(false)}>Prekliči</Button>
          <Button onClick={handleNotesSave} variant="contained">
            Shrani
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Seznam; 