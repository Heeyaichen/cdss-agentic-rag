import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Grid,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Paper,
} from '@mui/material';
import { usePatientSearch, usePatient } from '@/hooks/usePatientData';
import { useParams } from 'react-router-dom';

export default function PatientPage() {
  const { id } = useParams<{ id: string }>();
  const [search, setSearch] = useState('');
  const { data: searchResults, isLoading } = usePatientSearch(search);
  const { data: selectedPatient } = usePatient(id || '');

  const patient = id ? selectedPatient : null;

  return (
    <Box>
      <Typography variant="h4" gutterBottom fontWeight={600}>
        Patient Management
      </Typography>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <TextField
            fullWidth
            label="Search Patients"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by patient ID or name..."
          />
        </CardContent>
      </Card>

      <Grid container spacing={3}>
        <Grid item xs={12} md={patient ? 4 : 12}>
          <Paper>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Patient ID</TableCell>
                  <TableCell>Age</TableCell>
                  <TableCell>Sex</TableCell>
                  <TableCell>Conditions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {(searchResults?.patients || []).slice(0, 10).map((p) => (
                  <TableRow key={p.patient_id} hover>
                    <TableCell>{p.patient_id}</TableCell>
                    <TableCell>{p.demographics.age}</TableCell>
                    <TableCell>{p.demographics.sex}</TableCell>
                    <TableCell>{p.active_conditions.length}</TableCell>
                  </TableRow>
                ))}
                {(!searchResults?.patients || searchResults.patients.length === 0) && (
                  <TableRow>
                    <TableCell colSpan={4} align="center">
                      No patients found
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </Paper>
        </Grid>

        {patient && (
          <Grid item xs={12} md={8}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Patient Profile: {patient.patient_id}
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="text.secondary">
                      Age
                    </Typography>
                    <Typography variant="body1">{patient.demographics.age} years</Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="text.secondary">
                      Sex
                    </Typography>
                    <Typography variant="body1">{patient.demographics.sex}</Typography>
                  </Grid>
                </Grid>

                <Typography variant="h6" sx={{ mt: 3, mb: 1 }}>
                  Active Conditions
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                  {patient.active_conditions.map((c, i) => (
                    <Chip key={i} label={c.display} size="small" color="primary" />
                  ))}
                </Box>

                <Typography variant="h6" sx={{ mt: 3, mb: 1 }}>
                  Medications
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                  {patient.active_medications.map((m, i) => (
                    <Chip key={i} label={m.name} size="small" variant="outlined" />
                  ))}
                </Box>

                <Typography variant="h6" sx={{ mt: 3, mb: 1 }}>
                  Allergies
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                  {patient.allergies.map((a, i) => (
                    <Chip
                      key={i}
                      label={`${a.substance} (${a.severity})`}
                      size="small"
                      color={a.severity === 'severe' ? 'error' : 'warning'}
                    />
                  ))}
                </Box>
              </CardContent>
            </Card>
          </Grid>
        )}
      </Grid>
    </Box>
  );
}
