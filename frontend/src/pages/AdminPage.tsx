import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Grid,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Chip,
} from '@mui/material';
import { Search } from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { clinicalApi } from '@/lib/api-client';

interface AuditRow {
  timestamp: string;
  event_type: string;
  actor?: { clinician_id?: string };
  action: string;
  resource?: { type?: string };
  outcome: string;
  data_sent_to_llm?: boolean;
}

type SystemStatus = 'connected' | 'operational' | 'warning' | 'error';

export default function AdminPage() {
  const [filters, setFilters] = useState({
    start_date: '',
    end_date: '',
    event_type: '',
  });

  const { data: auditData, isLoading } = useQuery({
    queryKey: ['audit', filters],
    queryFn: () => clinicalApi.getAuditTrail(filters),
  });

  const getOutcomeColor = (outcome: string) => {
    switch (outcome) {
      case 'success':
        return 'success';
      case 'failure':
        return 'error';
      case 'denied':
        return 'warning';
      default:
        return 'default';
    }
  };

  return (
    <Box>
      <Typography variant="h4" gutterBottom fontWeight={600}>
        Admin Panel
      </Typography>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Audit Trail Filters
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} md={3}>
              <TextField
                fullWidth
                type="date"
                label="Start Date"
                value={filters.start_date}
                onChange={(e) =>
                  setFilters({ ...filters, start_date: e.target.value })
                }
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <TextField
                fullWidth
                type="date"
                label="End Date"
                value={filters.end_date}
                onChange={(e) =>
                  setFilters({ ...filters, end_date: e.target.value })
                }
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                label="Event Type"
                value={filters.event_type}
                onChange={(e) =>
                  setFilters({ ...filters, event_type: e.target.value })
                }
                placeholder="patient_data_access, llm_interaction..."
              />
            </Grid>
            <Grid item xs={12} md={2}>
              <Button
                fullWidth
                variant="contained"
                startIcon={<Search />}
                sx={{ height: '100%' }}
              >
                Search
              </Button>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      <Paper>
        <Box sx={{ p: 2 }}>
          <Typography variant="h6">Audit Log</Typography>
        </Box>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Timestamp</TableCell>
              <TableCell>Event Type</TableCell>
              <TableCell>Actor</TableCell>
              <TableCell>Action</TableCell>
              <TableCell>Resource</TableCell>
              <TableCell>Outcome</TableCell>
              <TableCell>PHI Sent</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} align="center">
                  Loading...
                </TableCell>
              </TableRow>
            ) : (
              (((auditData as AuditRow[]) ?? []).slice(0, 50)).map((entry: AuditRow, i: number) => (
                <TableRow key={i} hover>
                  <TableCell>
                    {dayjs(entry.timestamp).format('YYYY-MM-DD HH:mm:ss')}
                  </TableCell>
                  <TableCell>{entry.event_type}</TableCell>
                  <TableCell>{entry.actor?.clinician_id || 'N/A'}</TableCell>
                  <TableCell>{entry.action}</TableCell>
                  <TableCell>{entry.resource?.type || 'N/A'}</TableCell>
                  <TableCell>
                    <Chip
                      label={entry.outcome}
                      size="small"
                      color={getOutcomeColor(entry.outcome) as 'success' | 'error' | 'warning' | 'default'}
                    />
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={entry.data_sent_to_llm ? 'Yes' : 'No'}
                      size="small"
                      color={entry.data_sent_to_llm ? 'warning' : 'default'}
                    />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Paper>
    </Box>
  );
}
