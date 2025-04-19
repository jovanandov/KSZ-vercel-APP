import React from 'react';
import {
  Box,
  Typography,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import { useChecklist } from '../context/ChecklistContext';
import DeleteIcon from '@mui/icons-material/Delete';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import FileUploadIcon from '@mui/icons-material/FileUpload';

const Nastavitve: React.FC = () => {
  const { checklists, deleteChecklist } = useChecklist();
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);
  const [selectedChecklist, setSelectedChecklist] = React.useState<number | null>(null);

  const handleDeleteClick = (id: number) => {
    setSelectedChecklist(id);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (selectedChecklist) {
      await deleteChecklist(selectedChecklist);
      setDeleteDialogOpen(false);
    }
  };

  const handleExport = () => {
    const data = JSON.stringify(checklists, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'kontrolni-seznami.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = JSON.parse(e.target?.result as string);
          // Tukaj bi dodali logiko za uvoz podatkov
          console.log('Uvoženi podatki:', data);
        } catch (error) {
          console.error('Napaka pri branju datoteke:', error);
        }
      };
      reader.readAsText(file);
    }
  };

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Nastavitve
      </Typography>

      <Box sx={{ mb: 4 }}>
        <Typography variant="h6" gutterBottom>
          Izvoz/Uvoz podatkov
        </Typography>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button
            variant="contained"
            startIcon={<FileDownloadIcon />}
            onClick={handleExport}
          >
            Izvozi podatke
          </Button>
          <Button
            variant="contained"
            component="label"
            startIcon={<FileUploadIcon />}
          >
            Uvozi podatke
            <input
              type="file"
              hidden
              accept=".json"
              onChange={handleImport}
            />
          </Button>
        </Box>
      </Box>

      <Typography variant="h6" gutterBottom>
        Seznami
      </Typography>
      <List>
        {checklists.map((checklist) => (
          <ListItem
            key={checklist.id}
            sx={{
              bgcolor: 'background.paper',
              mb: 1,
              borderRadius: 1,
            }}
          >
            <ListItemText
              primary={checklist.title}
              secondary={`${checklist.items.length} postavk`}
            />
            <ListItemSecondaryAction>
              <IconButton
                edge="end"
                onClick={() => handleDeleteClick(checklist.id)}
              >
                <DeleteIcon />
              </IconButton>
            </ListItemSecondaryAction>
          </ListItem>
        ))}
      </List>

      <Dialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
      >
        <DialogTitle>Potrdi brisanje</DialogTitle>
        <DialogContent>
          <Typography>
            Ali ste prepričani, da želite izbrisati ta seznam? To dejanje ni mogoče razveljaviti.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Prekliči</Button>
          <Button onClick={handleDeleteConfirm} color="error">
            Izbriši
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Nastavitve; 