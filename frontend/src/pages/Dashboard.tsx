import React from 'react';
import { Box, Grid, Card, CardContent, Typography, Paper } from '@mui/material';
import { QueryStats, Person, Medication, Description, Warning, CheckCircle } from '@mui/icons-material';

export default function Dashboard() {
  return (
    <Box>
      <Typography variant="h4" gutterBottom fontWeight={600}>
        Dashboard
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 4 }}>
        Clinical Decision Support System Overview
      </Typography>

      <Grid container spacing={3}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography color="text.secondary" variant="body2">
                    Queries Today
                  </Typography>
                  <Typography variant="h4" fontWeight={600}>
                    142
                  </Typography>
                </Box>
                <QueryStats color="primary" sx={{ fontSize: 40 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography color="text.secondary" variant="body2">
                    Active Patients
                  </Typography>
                  <Typography variant="h4" fontWeight={600}>
                    1,284
                  </Typography>
                </Box>
                <Person color="success" sx={{ fontSize: 40 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography color="text.secondary" variant="body2">
                    Drug Alerts
                  </Typography>
                  <Typography variant="h4" fontWeight={600}>
                    23
                  </Typography>
                </Box>
                <Warning color="warning" sx={{ fontSize: 40 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography color="text.secondary" variant="body2">
                    System Health
                  </Typography>
                  <Typography variant="h4" fontWeight={600}>
                    99.9%
                  </Typography>
                </Box>
                <CheckCircle color="success" sx={{ fontSize: 40 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Grid container spacing={3} sx={{ mt: 2 }}>
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Recent Queries
            </Typography>
            <Typography variant="body2" color="text.secondary">
              No recent queries to display.
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              System Status
            </Typography>
            <Typography variant="body2" color="text.secondary">
              All systems operational.
            </Typography>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}
