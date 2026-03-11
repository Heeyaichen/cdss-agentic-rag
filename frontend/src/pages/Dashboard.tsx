import React from 'react';
import { Box, Grid, Card, CardContent, Typography, Paper, Chip, useTheme, alpha } from '@mui/material';
import { QueryStats, Person, Medication, Description, Warning, CheckCircle, Science } from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import { clinicalApi } from '@/lib/api-client';
import { DashboardSkeleton } from '@/components/common/LoadingSkeleton';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  color: string;
  subtitle?: string;
}

function StatCard({ title, value, icon, color, subtitle }: StatCardProps) {
  
  return (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Box>
            <Typography color="text.secondary" variant="body2" gutterBottom>
              {title}
            </Typography>
            <Typography variant="h4" fontWeight={600}>
              {value}
            </Typography>
            {subtitle && (
              <Typography variant="caption" color="text.secondary">
                {subtitle}
              </Typography>
            )}
          </Box>
          <Box
            sx={{
              p: 1.5,
              borderRadius: 2,
              bgcolor: alpha(color, 0.1),
              color: color,
            }}
          >
            {icon}
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
}

export default function Dashboard() {
  const theme = useTheme();
  
  const { data: patientData, isLoading: patientsLoading } = useQuery<any>({
    queryKey: ['patients', 'search', '', 1, 100],
    queryFn: () => clinicalApi.searchPatients({ search: '', page: 1, limit: 100 }),
  });

  const { data: healthData, isLoading: healthLoading } = useQuery<any>({
    queryKey: ['health'],
    queryFn: () => clinicalApi.getHealthCheck(),
  });

  const isLoading = patientsLoading || healthLoading;

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  const totalPatients = (patientData as any)?.total ?? 0;
  const systemStatus = (healthData as any)?.status ?? 'unknown';
  const services: Record<string, string> = ((healthData as any)?.services ?? {}) as Record<string, string>;

  const recentActivity = [
    { id: 1, type: 'query', description: 'Diabetes treatment options query', time: '2 hours ago', status: 'completed' },
    { id: 2, type: 'patient', description: 'Patient P001 profile viewed', time: '3 hours ago', status: 'completed' },
    { id: 3, type: 'drug', description: 'Drug interaction check: Metformin + Lisinopril', time: '5 hours ago', status: 'warning' },
    { id: 4, type: 'document', description: 'Clinical guideline uploaded', time: '1 day ago', status: 'completed' },
    { id: 5, type: 'query', description: 'CKD management protocols query', time: '1 day ago', status: 'completed' },
  ];

  const quickActions = [
    { label: 'New Query', path: '/query', icon: <QueryStats />, color: theme.palette.primary.main },
    { label: 'View Patients', path: '/patients', icon: <Person />, color: theme.palette.success.main },
    { label: 'Drug Check', path: '/drugs', icon: <Medication />, color: theme.palette.warning.main },
    { label: 'Literature', path: '/literature', icon: <Science />, color: theme.palette.info.main },
  ];

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
          <StatCard
            title="Total Patients"
            value={totalPatients}
            icon={<Person sx={{ fontSize: 32 }} />}
            color={theme.palette.success.main}
            subtitle="Active records"
          />
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Queries Today"
            value={142}
            icon={<QueryStats sx={{ fontSize: 32 }} />}
            color={theme.palette.primary.main}
            subtitle="Clinical queries processed"
          />
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Drug Alerts"
            value={23}
            icon={<Warning sx={{ fontSize: 32 }} />}
            color={theme.palette.warning.main}
            subtitle="Requiring review"
          />
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="System Health"
            value={systemStatus === 'healthy' ? '99.9%' : systemStatus}
            icon={<CheckCircle sx={{ fontSize: 32 }} />}
            color={systemStatus === 'healthy' ? theme.palette.success.main : theme.palette.error.main}
            subtitle="Uptime this month"
          />
        </Grid>
      </Grid>

      <Grid container spacing={3} sx={{ mt: 2 }}>
        <Grid item xs={12} md={8}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom fontWeight={600}>
              Recent Activity
            </Typography>
            {recentActivity.map((activity) => (
              <Box
                key={activity.id}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  py: 1.5,
                  borderBottom: `1px solid ${theme.palette.divider}`,
                  '&:last-child': { borderBottom: 'none' },
                }}
              >
                <Box
                  sx={{
                    p: 1,
                    borderRadius: 1,
                    bgcolor: alpha(
                      activity.status === 'warning' ? theme.palette.warning.main : theme.palette.primary.main,
                      0.1
                    ),
                    color: activity.status === 'warning' ? theme.palette.warning.main : theme.palette.primary.main,
                    mr: 2,
                  }}
                >
                  {activity.type === 'query' && <QueryStats fontSize="small" />}
                  {activity.type === 'patient' && <Person fontSize="small" />}
                  {activity.type === 'drug' && <Medication fontSize="small" />}
                  {activity.type === 'document' && <Description fontSize="small" />}
                </Box>
                <Box sx={{ flex: 1 }}>
                  <Typography variant="body2">{activity.description}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {activity.time}
                  </Typography>
                </Box>
                <Chip
                  label={activity.status}
                  size="small"
                  color={activity.status === 'warning' ? 'warning' : 'success'}
                />
              </Box>
            ))}
          </Paper>
        </Grid>

        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 3, mb: 3 }}>
            <Typography variant="h6" gutterBottom fontWeight={600}>
              Quick Actions
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {quickActions.map((action) => (
                <Box
                  key={action.label}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 2,
                    p: 1.5,
                    borderRadius: 1,
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    '&:hover': {
                      bgcolor: alpha(action.color, 0.1),
                    },
                  }}
                >
                  <Box sx={{ color: action.color }}>{action.icon}</Box>
                  <Typography variant="body2" fontWeight={500}>
                    {action.label}
                  </Typography>
                </Box>
              ))}
            </Box>
          </Paper>

          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom fontWeight={600}>
              System Status
            </Typography>
            {Object.entries(services).map(([service, status]) => (
              <Box
                key={service}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  py: 1,
                  borderBottom: `1px solid ${theme.palette.divider}`,
                  '&:last-child': { borderBottom: 'none' },
                }}
              >
                <Typography variant="body2" sx={{ textTransform: 'capitalize' }}>
                  {service.replace(/_/g, ' ')}
                </Typography>
                <Chip
                  label={status}
                  size="small"
                  color={status === 'healthy' ? 'success' : status === 'degraded' ? 'warning' : 'error'}
                />
              </Box>
            ))}
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}
