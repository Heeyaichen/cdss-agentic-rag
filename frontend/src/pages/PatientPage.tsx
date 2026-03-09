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
  Divider,
  Tabs,
  Tab,
  useTheme,
  alpha,
  Skeleton,
} from '@mui/material';
import { Person, Medication, Warning, Science, History } from '@mui/icons-material';
import { usePatientSearch, usePatient } from '@/hooks/usePatientData';
import { useParams, useNavigate } from 'react-router-dom';
import LabResultsChart from '@/components/patient/LabResultsChart';
import MedicationList from '@/components/patient/MedicationList';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div hidden={value !== index} {...other}>
      {value === index && <Box sx={{ pt: 3 }}>{children}</Box>}
    </div>
  );
}

export default function PatientPage() {
  const theme = useTheme();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [search, setSearch] = useState('');
  const [tabValue, setTabValue] = useState(0);
  
  const { data: searchResults, isLoading: searchLoading } = usePatientSearch(search);
  const { data: selectedPatient, isLoading: patientLoading } = usePatient(id || '');

  // Cast to any to avoid cascading TS errors due to complex nested data shapes
  const patient = id ? (selectedPatient as any) : null;
  const isLoading = id ? patientLoading : searchLoading;

  return (
    <Box>
      <Typography variant="h4" gutterBottom fontWeight={600}>
        Patient Management
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Search and view patient profiles with medical history, medications, and lab results
      </Typography>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <TextField
            fullWidth
            label="Search Patients"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by patient ID or name..."
            disabled={!!id}
          />
        </CardContent>
      </Card>

      <Grid container spacing={3}>
        <Grid item xs={12} md={patient ? 4 : 12}>
          <Paper>
            {isLoading ? (
              <Box sx={{ p: 2 }}>
                <Skeleton variant="rectangular" height={40} sx={{ mb: 1 }} />
                <Skeleton variant="rectangular" height={300} />
              </Box>
            ) : (
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Patient ID</TableCell>
                    <TableCell>Age</TableCell>
                    <TableCell>Sex</TableCell>
                    <TableCell>Conditions</TableCell>
                    <TableCell>Meds</TableCell>
                  </TableRow>
                </TableHead>
              <TableBody>
                  {(((searchResults as any)?.patients) ?? []).slice(0, 10).map((p: any) => (
                    <TableRow
                      key={p.patient_id}
                      hover
                      onClick={() => navigate(`/patients/${p.patient_id}`)}
                      selected={id === p.patient_id}
                      sx={{ cursor: 'pointer' }}
                    >
                      <TableCell>
                        <Typography variant="body2" fontWeight={600}>
                          {p.patient_id}
                        </Typography>
                      </TableCell>
                      <TableCell>{p.demographics.age}</TableCell>
                      <TableCell>{p.demographics.sex}</TableCell>
                      <TableCell>
                        <Chip
                          label={p.active_conditions.length}
                          size="small"
                          color="primary"
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={p.active_medications.length}
                          size="small"
                          color="secondary"
                          variant="outlined"
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                  {(!searchResults?.patients || searchResults.patients.length === 0) && (
                    <TableRow>
                      <TableCell colSpan={5} align="center">
                        <Typography variant="body2" color="text.secondary" sx={{ py: 4 }}>
                          No patients found. Try a different search term.
                        </Typography>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </Paper>
        </Grid>

        {patient && (
          <Grid item xs={12} md={8}>
            <Card sx={{ mb: 3 }}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
                  <Box
                    sx={{
                      width: 64,
                      height: 64,
                      borderRadius: '50%',
                      bgcolor: alpha(theme.palette.primary.main, 0.1),
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Person sx={{ fontSize: 32, color: 'primary.main' }} />
                  </Box>
                  <Box>
                    <Typography variant="h5" fontWeight={600}>
                      Patient {patient.patient_id}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Last updated: {new Date(patient.last_updated).toLocaleDateString()}
                    </Typography>
                  </Box>
                </Box>

                <Grid container spacing={3}>
                  <Grid item xs={6} sm={3}>
                    <Typography variant="caption" color="text.secondary" textTransform="uppercase">
                      Age
                    </Typography>
                    <Typography variant="body1" fontWeight={600}>
                      {patient.demographics.age} years
                    </Typography>
                  </Grid>
                  <Grid item xs={6} sm={3}>
                    <Typography variant="caption" color="text.secondary" textTransform="uppercase">
                      Sex
                    </Typography>
                    <Typography variant="body1" fontWeight={600}>
                      {patient.demographics.sex}
                    </Typography>
                  </Grid>
                  <Grid item xs={6} sm={3}>
                    <Typography variant="caption" color="text.secondary" textTransform="uppercase">
                      Weight
                    </Typography>
                    <Typography variant="body1" fontWeight={600}>
                      {patient.demographics.weight_kg} kg
                    </Typography>
                  </Grid>
                  <Grid item xs={6} sm={3}>
                    <Typography variant="caption" color="text.secondary" textTransform="uppercase">
                      Height
                    </Typography>
                    <Typography variant="body1" fontWeight={600}>
                      {patient.demographics.height_cm} cm
                    </Typography>
                  </Grid>
                </Grid>

                <Divider sx={{ my: 3 }} />

                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                      <Science fontSize="small" color="primary" />
                      <Typography variant="subtitle2">Conditions</Typography>
                    </Box>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                      {patient.active_conditions.map((c, i) => (
                        <Chip
                          key={i}
                          label={c.display}
                          size="small"
                          color="primary"
                          variant="outlined"
                        />
                      ))}
                    </Box>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                      <Warning fontSize="small" color="warning" />
                      <Typography variant="subtitle2">Allergies</Typography>
                    </Box>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                      {patient.allergies.length > 0 ? (
                        patient.allergies.map((a, i) => (
                          <Chip
                            key={i}
                            label={`${a.substance} (${a.severity})`}
                            size="small"
                            color={a.severity === 'severe' ? 'error' : 'warning'}
                          />
                        ))
                      ) : (
                        <Typography variant="body2" color="text.secondary">
                          No known allergies
                        </Typography>
                      )}
                    </Box>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>

            <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
              <Tabs value={tabValue} onChange={(_, v) => setTabValue(v)}>
                <Tab icon={<Medication />} label="Medications" iconPosition="start" />
                <Tab icon={<Science />} label="Lab Results" iconPosition="start" />
                <Tab icon={<History />} label="Medical History" iconPosition="start" />
              </Tabs>
            </Box>

            <TabPanel value={tabValue} index={0}>
              <MedicationList
                medications={patient.active_medications}
                title="Current Medications"
              />
            </TabPanel>

            <TabPanel value={tabValue} index={1}>
              <LabResultsChart
                labResults={patient.recent_labs}
                title="Recent Lab Results"
              />
              <Paper sx={{ p: 2, mt: 2 }}>
                <Typography variant="subtitle2" gutterBottom fontWeight={600}>
                  Latest Lab Values
                </Typography>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Test</TableCell>
                      <TableCell>Value</TableCell>
                      <TableCell>Unit</TableCell>
                      <TableCell>Reference</TableCell>
                      <TableCell>Date</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {patient.recent_labs.map((lab, i) => (
                      <TableRow key={i}>
                        <TableCell>{lab.display}</TableCell>
                        <TableCell>
                          <Typography
                            fontWeight={600}
                            color={
                              lab.reference_range &&
                              (lab.value < parseFloat(lab.reference_range.split('-')[0]) ||
                                lab.value > parseFloat(lab.reference_range.split('-')[1] || '999'))
                                ? 'error.main'
                                : 'success.main'
                            }
                          >
                            {lab.value}
                          </Typography>
                        </TableCell>
                        <TableCell>{lab.unit}</TableCell>
                        <TableCell>{lab.reference_range || 'N/A'}</TableCell>
                        <TableCell>{new Date(lab.test_date).toLocaleDateString()}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Paper>
            </TabPanel>

            <TabPanel value={tabValue} index={2}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom fontWeight={600}>
                    Active Conditions
                  </Typography>
                  {patient.active_conditions.map((condition, i) => (
                    <Box key={i} sx={{ mb: 2 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="body1" fontWeight={600}>
                          {condition.display}
                        </Typography>
                        <Chip label={condition.status} size="small" color="info" />
                      </Box>
                      <Typography variant="caption" color="text.secondary">
                        Code: {condition.code} ({condition.coding_system}) | Onset: {condition.onset_date || 'Unknown'}
                      </Typography>
                    </Box>
                  ))}
                </CardContent>
              </Card>
            </TabPanel>
          </Grid>
        )}
      </Grid>
    </Box>
  );
}
