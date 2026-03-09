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
  Divider,
  useTheme,
  alpha,
} from '@mui/material';
import { Search, Warning, Error as ErrorIcon, Info, Add, Delete } from '@mui/icons-material';
import { useMutation } from '@tanstack/react-query';
import { clinicalApi } from '@/lib/api-client';
import { DrugInteraction } from '@/lib/types';
import InteractionMatrix from '@/components/drugs/InteractionMatrix';

export default function DrugCheckerPage() {
  const theme = useTheme();
  const [medications, setMedications] = useState<string[]>([]);
  const [inputValue, setInputValue] = useState('');

  const checkInteractions = useMutation({
    mutationFn: () =>
      clinicalApi.checkDrugInteractions(
        medications.map((m) => ({ name: m }))
      ),
  });

  const handleAdd = () => {
    const trimmed = inputValue.trim();
    if (trimmed && !medications.includes(trimmed)) {
      setMedications([...medications, trimmed]);
      setInputValue('');
    }
  };

  const handleRemove = (med: string) => {
    setMedications(medications.filter((m) => m !== med));
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleAdd();
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'major':
        return theme.palette.error.main;
      case 'moderate':
        return theme.palette.warning.main;
      case 'minor':
        return theme.palette.info.main;
      default:
        return theme.palette.grey[500];
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'major':
        return <ErrorIcon fontSize="small" />;
      case 'moderate':
        return <Warning fontSize="small" />;
      case 'minor':
        return <Info fontSize="small" />;
      default:
        return null;
    }
  };

  const interactions = checkInteractions.data?.interactions || [];
  const majorCount = interactions.filter((i: DrugInteraction) => i.severity === 'major').length;
  const moderateCount = interactions.filter((i: DrugInteraction) => i.severity === 'moderate').length;
  const minorCount = interactions.filter((i: DrugInteraction) => i.severity === 'minor').length;

  return (
    <Box>
      <Typography variant="h4" gutterBottom fontWeight={600}>
        Drug Interaction Checker
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Check for potential drug-drug interactions between medications
      </Typography>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Add Medications
          </Typography>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={8}>
              <TextField
                fullWidth
                label="Medication Name"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Enter medication name and press Enter..."
                size="small"
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <Button
                fullWidth
                variant="contained"
                startIcon={<Add />}
                onClick={handleAdd}
                disabled={!inputValue.trim()}
              >
                Add Medication
              </Button>
            </Grid>
          </Grid>

          {medications.length > 0 && (
            <Box sx={{ mt: 3 }}>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                Added Medications ({medications.length})
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {medications.map((med) => (
                  <Chip
                    key={med}
                    label={med}
                    onDelete={() => handleRemove(med)}
                    color="primary"
                    variant="outlined"
                    deleteIcon={<Delete />}
                  />
                ))}
              </Box>
            </Box>
          )}

          <Divider sx={{ my: 3 }} />

          <Button
            variant="contained"
            color="primary"
            size="large"
            startIcon={<Search />}
            onClick={() => checkInteractions.mutate()}
            disabled={medications.length < 2 || checkInteractions.isPending}
          >
            {checkInteractions.isPending ? 'Checking...' : 'Check Interactions'}
          </Button>

          {medications.length < 2 && (
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
              Add at least 2 medications to check for interactions
            </Typography>
          )}
        </CardContent>
      </Card>

      {checkInteractions.isPending && (
        <Alert severity="info" sx={{ mb: 3 }}>
          Checking for drug interactions...
        </Alert>
      )}

      {checkInteractions.isError && (
        <Alert severity="error" sx={{ mb: 3 }}>
          Failed to check interactions. Please try again.
        </Alert>
      )}

      {checkInteractions.data && (
        <Box>
          {(majorCount > 0 || moderateCount > 0 || minorCount > 0) && (
            <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
              {majorCount > 0 && (
                <Paper sx={{ p: 2, bgcolor: alpha(theme.palette.error.main, 0.1) }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <ErrorIcon color="error" />
                    <Typography fontWeight={600} color="error.main">
                      {majorCount} Major
                    </Typography>
                  </Box>
                </Paper>
              )}
              {moderateCount > 0 && (
                <Paper sx={{ p: 2, bgcolor: alpha(theme.palette.warning.main, 0.1) }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Warning color="warning" />
                    <Typography fontWeight={600} color="warning.main">
                      {moderateCount} Moderate
                    </Typography>
                  </Box>
                </Paper>
              )}
              {minorCount > 0 && (
                <Paper sx={{ p: 2, bgcolor: alpha(theme.palette.info.main, 0.1) }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Info color="info" />
                    <Typography fontWeight={600} color="info.main">
                      {minorCount} Minor
                    </Typography>
                  </Box>
                </Paper>
              )}
            </Box>
          )}

          <Grid container spacing={3}>
            <Grid item xs={12}>
              <Typography variant="h6" gutterBottom fontWeight={600}>
                Interaction Matrix
              </Typography>
              <InteractionMatrix
                medications={medications}
                interactions={interactions}
              />
            </Grid>

            <Grid item xs={12}>
              <Typography variant="h6" gutterBottom fontWeight={600}>
                Detailed Results
              </Typography>
              <Paper>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Drug A</TableCell>
                      <TableCell>Drug B</TableCell>
                      <TableCell>Severity</TableCell>
                      <TableCell>Description</TableCell>
                      <TableCell>Evidence</TableCell>
                      <TableCell>Source</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {interactions.map((interaction: DrugInteraction, i: number) => (
                      <TableRow key={i} hover>
                        <TableCell>{interaction.drug_a}</TableCell>
                        <TableCell>{interaction.drug_b}</TableCell>
                        <TableCell>
                          <Chip
                            icon={getSeverityIcon(interaction.severity)}
                            label={interaction.severity.toUpperCase()}
                            sx={{
                              bgcolor: alpha(getSeverityColor(interaction.severity), 0.15),
                              color: getSeverityColor(interaction.severity),
                              fontWeight: 600,
                            }}
                            size="small"
                          />
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" sx={{ maxWidth: 300 }}>
                            {interaction.description}
                          </Typography>
                        </TableCell>
                        <TableCell>Level {interaction.evidence_level}</TableCell>
                        <TableCell>{interaction.source}</TableCell>
                      </TableRow>
                    ))}
                    {interactions.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} align="center">
                          <Box sx={{ py: 4 }}>
                            <CheckCircle sx={{ fontSize: 48, color: 'success.main', mb: 1 }} />
                            <Typography variant="h6" color="success.main">
                              No Interactions Found
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              No known interactions between the selected medications
                            </Typography>
                          </Box>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </Paper>
            </Grid>

            {checkInteractions.data.alternatives && checkInteractions.data.alternatives.length > 0 && (
              <Grid item xs={12}>
                <Paper sx={{ p: 2 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    Suggested Alternatives
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                    {checkInteractions.data.alternatives.map((alt: string, i: number) => (
                      <Chip key={i} label={alt} color="primary" variant="outlined" />
                    ))}
                  </Box>
                </Paper>
              </Grid>
            )}

            {checkInteractions.data.dosage_adjustments && checkInteractions.data.dosage_adjustments.length > 0 && (
              <Grid item xs={12}>
                <Paper sx={{ p: 2 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    Dosage Adjustments
                  </Typography>
                  <Box component="ul" sx={{ pl: 2, m: 0 }}>
                    {checkInteractions.data.dosage_adjustments.map((adj: string, i: number) => (
                      <Typography component="li" key={i} variant="body2">
                        {adj}
                      </Typography>
                    ))}
                  </Box>
                </Paper>
              </Grid>
            )}
          </Grid>
        </Box>
      )}
    </Box>
  );
}
