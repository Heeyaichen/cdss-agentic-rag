import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Chip,
  Grid,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Alert,
} from '@mui/material';
import { Search, Warning, Error, Info } from '@mui/icons-material';
import { useMutation } from '@tanstack/react-query';
import { clinicalApi } from '@/lib/api-client';
import { DrugInteraction } from '@/lib/types';

export default function DrugCheckerPage() {
  const [medications, setMedications] = useState<string[]>([]);
  const [inputValue, setInputValue] = useState('');

  const checkInteractions = useMutation({
    mutationFn: () =>
      clinicalApi.checkDrugInteractions(
        medications.map((m) => ({ name: m }))
      ),
  });

  const handleAdd = () => {
    if (inputValue.trim() && !medications.includes(inputValue.trim())) {
      setMedications([...medications, inputValue.trim()]);
      setInputValue('');
    }
  };

  const handleRemove = (med: string) => {
    setMedications(medications.filter((m) => m !== med));
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'major':
        return 'error';
      case 'moderate':
        return 'warning';
      case 'minor':
        return 'info';
      default:
        return 'default';
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'major':
        return <Error />;
      case 'moderate':
        return <Warning />;
      case 'minor':
        return <Info />;
      default:
        return null;
    }
  };

  return (
    <Box>
      <Typography variant="h4" gutterBottom fontWeight={600}>
        Drug Interaction Checker
      </Typography>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={8}>
              <TextField
                fullWidth
                label="Add Medication"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleAdd()}
                placeholder="Enter medication name..."
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <Button
                fullWidth
                variant="contained"
                startIcon={<Search />}
                onClick={handleAdd}
                disabled={!inputValue.trim()}
              >
                Add Medication
              </Button>
            </Grid>
          </Grid>

          <Box sx={{ mt: 2, display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            {medications.map((med) => (
              <Chip
                key={med}
                label={med}
                onDelete={() => handleRemove(med)}
                color="primary"
              />
            ))}
          </Box>

          <Button
            variant="contained"
            color="primary"
            size="large"
            sx={{ mt: 3 }}
            onClick={() => checkInteractions.mutate()}
            disabled={medications.length < 2}
          >
            Check Interactions
          </Button>
        </CardContent>
      </Card>

      {checkInteractions.isPending && (
        <Alert severity="info">Checking for drug interactions...</Alert>
      )}

      {checkInteractions.isError && (
        <Alert severity="error">
          Failed to check interactions. Please try again.
        </Alert>
      )}

      {checkInteractions.data && (
        <Paper>
          <Box sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              Interaction Results
            </Typography>
          </Box>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Drug A</TableCell>
                <TableCell>Drug B</TableCell>
                <TableCell>Severity</TableCell>
                <TableCell>Description</TableCell>
                <TableCell>Evidence</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {(checkInteractions.data.interactions || []).map(
                (interaction: DrugInteraction, i: number) => (
                  <TableRow key={i}>
                    <TableCell>{interaction.drug_a}</TableCell>
                    <TableCell>{interaction.drug_b}</TableCell>
                    <TableCell>
                      <Chip
                        icon={getSeverityIcon(interaction.severity)}
                        label={interaction.severity.toUpperCase()}
                        color={getSeverityColor(interaction.severity) as any}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>{interaction.description}</TableCell>
                    <TableCell>Level {interaction.evidence_level}</TableCell>
                  </TableRow>
                )
              )}
              {checkInteractions.data.interactions?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} align="center">
                    No interactions found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Paper>
      )}
    </Box>
  );
}
