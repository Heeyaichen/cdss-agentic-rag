import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Autocomplete,
  Chip,
  LinearProgress,
  Alert,
  Grid,
  Paper,
  Divider,
} from '@mui/material';
import { Search, Send, Cancel } from '@mui/icons-material';
import { usePatientSearch, useSelectedPatient, useSetSelectedPatient } from '@/hooks/usePatientData';
import { useStreamingQuery } from '@/hooks/useStreamingQuery';
import { PatientProfile } from '@/lib/types';
import DrugAlertBanner from '@/components/clinical/DrugAlertBanner';
import ResponseViewer from '@/components/clinical/ResponseViewer';

const COMMON_QUERIES = [
  "What are the recommended treatment options for type 2 diabetes with CKD?",
  "Check for drug interactions between metformin and lisinopril",
  "What is the differential diagnosis for elevated troponin?",
  "Review current ADA guidelines for HbA1c targets",
];

export default function QueryPage() {
  const [query, setQuery] = useState('');
  const [patientSearch, setPatientSearch] = useState('');
  const selectedPatient = useSelectedPatient();
  const setSelectedPatient = useSetSelectedPatient();
  
  const { data: patientSearchResults, isLoading: searchingPatients } = usePatientSearch(patientSearch);
  const { response, isStreaming, progress, agentProgress, error, startStream, cancelStream, reset } = useStreamingQuery(
    query,
    selectedPatient.selectedPatientId || undefined
  );

  const handleSubmit = () => {
    if (query.trim()) {
      startStream();
    }
  };

  const handleCancel = () => {
    cancelStream();
    reset();
  };

  return (
    <Box>
      <Typography variant="h4" gutterBottom fontWeight={600}>
        Clinical Query Interface
      </Typography>

      <Grid container spacing={3}>
        <Grid item xs={12} md={8}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Submit a Clinical Query
              </Typography>

              <Autocomplete
                options={patientSearchResults?.patients || []}
                getOptionLabel={(option: PatientProfile) => `Patient ${option.patient_id}`}
                loading={searchingPatients}
                onInputChange={(_, value) => setPatientSearch(value)}
                onChange={(_, value) => setSelectedPatient(value)}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Select Patient (Optional)"
                    margin="normal"
                    fullWidth
                  />
                )}
                sx={{ mb: 2 }}
              />

              <TextField
                fullWidth
                multiline
                rows={4}
                label="Clinical Query"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Enter your clinical question..."
                disabled={isStreaming}
                sx={{ mb: 2 }}
              />

              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Common Queries:
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                  {COMMON_QUERIES.map((q, i) => (
                    <Chip
                      key={i}
                      label={q.substring(0, 40) + '...'}
                      onClick={() => setQuery(q)}
                      variant="outlined"
                      size="small"
                    />
                  ))}
                </Box>
              </Box>

              <Box sx={{ display: 'flex', gap: 2 }}>
                <Button
                  variant="contained"
                  size="large"
                  startIcon={<Send />}
                  onClick={handleSubmit}
                  disabled={!query.trim() || isStreaming}
                >
                  Submit Query
                </Button>
                {isStreaming && (
                  <Button
                    variant="outlined"
                    color="error"
                    size="large"
                    startIcon={<Cancel />}
                    onClick={handleCancel}
                  >
                    Cancel
                  </Button>
                )}
              </Box>

              {isStreaming && (
                <Box sx={{ mt: 3 }}>
                  <Typography variant="body2" gutterBottom>
                    Processing: {Math.round(progress)}%
                  </Typography>
                  <LinearProgress variant="determinate" value={progress} />
                  <Box sx={{ mt: 1 }}>
                    {Object.entries(agentProgress).map(([agent, prog]) => (
                      <Chip
                        key={agent}
                        label={`${agent}: ${Math.round(prog as number)}%`}
                        size="small"
                        sx={{ mr: 1, mb: 1 }}
                      />
                    ))}
                  </Box>
                </Box>
              )}

              {error && (
                <Alert severity="error" sx={{ mt: 2 }}>
                  {error}
                </Alert>
              )}
            </CardContent>
          </Card>

          {response && <ResponseViewer response={response} />}
        </Grid>

        <Grid item xs={12} md={4}>
          {selectedPatient.selectedPatient && (
            <Paper sx={{ p: 2 }}>
              <Typography variant="h6" gutterBottom>
                Selected Patient
              </Typography>
              <Typography variant="body2">
                ID: {selectedPatient.selectedPatient.patient_id}
              </Typography>
              <Typography variant="body2">
                Age: {selectedPatient.selectedPatient.demographics.age}
              </Typography>
              <Typography variant="body2">
                Sex: {selectedPatient.selectedPatient.demographics.sex}
              </Typography>
              <Divider sx={{ my: 2 }} />
              <Typography variant="body2" color="text.secondary">
                Conditions: {selectedPatient.selectedPatient.active_conditions.length}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Medications: {selectedPatient.selectedPatient.active_medications.length}
              </Typography>
            </Paper>
          )}

          {response && response.drug_alerts.length > 0 && (
            <Box sx={{ mt: 2 }}>
              <DrugAlertBanner alerts={response.drug_alerts} />
            </Box>
          )}
        </Grid>
      </Grid>
    </Box>
  );
}
