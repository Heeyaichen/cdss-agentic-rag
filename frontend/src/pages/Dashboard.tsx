import React from 'react';
import { Box, Grid, Card, CardContent, Typography, Paper, Chip, useTheme } from '@mui/material';
import { QueryStats, Person, Medication, Description, Warning, CheckCircle, Science } from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import { clinicalApi } from '@/lib/api-client';
import { DashboardSkeleton } from '@/components/common/LoadingSkeleton';
// Design tokens
import {
  primary,
  semantic,
  severity,
  clinical,
  alpha as alphaUtil,
  componentShadows,
  clinicalShadows,
  interactiveShadows,
  spacing,
  borderRadius,
  transitions,
  opacity,
  neutral,
} from '@/theme';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  color: string;
  subtitle?: string;
}

function StatCard({ title, value, icon, color, subtitle }: StatCardProps) {
  return (
    <Card
      sx={{
        height: '100%',
        borderRadius: borderRadius.md,
        boxShadow: componentShadows.card,
        border: `1px solid ${alphaUtil(color, opacity.light)}`,
        transition: `${transitions.shadow.standard}, ${transitions.transform.standard}, ${transitions.border.standard}`,
        '&:hover': {
          boxShadow: interactiveShadows.hover,
          transform: 'translateY(-2px)',
          borderColor: alphaUtil(color, opacity.medium),
        },
      }}
    >
      <CardContent sx={{ p: spacing[4] }}>
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Box flex={1} minWidth={0}>
            <Typography
              variant="body2"
              sx={{
                color: 'text.secondary',
                fontWeight: 500,
                letterSpacing: '0.025em',
                mb: 0.5,
                textTransform: 'uppercase',
                fontSize: '0.7rem',
              }}
            >
              {title}
            </Typography>
            <Typography
              variant="h4"
              sx={{
                fontWeight: 700,
                color: 'text.primary',
                lineHeight: 1.2,
                mb: 0.25,
              }}
            >
              {value}
            </Typography>
            {subtitle && (
              <Typography
                variant="caption"
                sx={{
                  color: color,
                  fontWeight: 500,
                  display: 'block',
                }}
              >
                {subtitle}
              </Typography>
            )}
          </Box>
          <Box
            sx={{
              p: 1.5,
              borderRadius: borderRadius.md,
              bgcolor: alphaUtil(color, opacity.light),
              color: color,
              transition: transitions.background.standard,
              flexShrink: 0,
              ml: 2,
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
    { label: 'New Query', path: '/query', icon: <QueryStats />, color: primary.main },
    { label: 'View Patients', path: '/patients', icon: <Person />, color: semantic.success.main },
    { label: 'Drug Check', path: '/drugs', icon: <Medication />, color: semantic.warning.main },
    { label: 'Literature', path: '/literature', icon: <Science />, color: semantic.info.main },
  ];

  // Get status color using clinical tokens
  const getActivityStatusColor = (status: string) => {
    if (status === 'warning') return semantic.warning.main;
    return semantic.success.main;
  };

  const getServiceStatusColor = (status: string) => {
    if (status === 'healthy') return semantic.success.main;
    if (status === 'degraded') return semantic.warning.main;
    return semantic.error.main;
  };

  return (
    <Box>
      {/* Header Section */}
      <Box sx={{ mb: spacing[8] }}>
        <Typography
          variant="h4"
          sx={{
            fontWeight: 700,
            color: 'text.primary',
            mb: spacing[1],
            letterSpacing: '-0.015em',
          }}
        >
          Dashboard
        </Typography>
        <Typography
          variant="body2"
          sx={{
            color: 'text.secondary',
            letterSpacing: '0.015em',
            fontWeight: 400,
          }}
        >
          Clinical Decision Support System Overview
        </Typography>
      </Box>

      {/* Stats Cards Grid */}
      <Grid container spacing={spacing[6]}>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Total Patients"
            value={totalPatients}
            icon={<Person sx={{ fontSize: 32 }} />}
            color={clinical.patientStatus.active}
            subtitle="Active records"
          />
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Queries Today"
            value={142}
            icon={<QueryStats sx={{ fontSize: 32 }} />}
            color={primary.main}
            subtitle="Clinical queries processed"
          />
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Drug Alerts"
            value={23}
            icon={<Warning sx={{ fontSize: 32 }} />}
            color={severity.moderate.main}
            subtitle="Requiring review"
          />
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="System Health"
            value={systemStatus === 'healthy' ? '99.9%' : systemStatus}
            icon={<CheckCircle sx={{ fontSize: 32 }} />}
            color={systemStatus === 'healthy' ? semantic.success.main : semantic.error.main}
            subtitle="Uptime this month"
          />
        </Grid>
      </Grid>

      {/* Main Content Grid */}
      <Grid container spacing={spacing[6]} sx={{ mt: spacing[2] }}>
        {/* Recent Activity Section */}
        <Grid item xs={12} md={8}>
          <Paper
            sx={{
              p: spacing[6],
              borderRadius: borderRadius.lg,
              boxShadow: componentShadows.card,
              transition: transitions.shadow.standard,
              '&:hover': {
                boxShadow: componentShadows.cardHover,
              },
            }}
          >
            <Typography
              variant="h6"
              sx={{
                fontWeight: 600,
                color: 'text.primary',
                mb: spacing[4],
                display: 'flex',
                alignItems: 'center',
                gap: 1,
              }}
            >
              Recent Activity
            </Typography>
            {recentActivity.map((activity, index) => (
              <Box
                key={activity.id}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  py: spacing[3],
                  px: spacing[2],
                  mx: -spacing[2],
                  borderRadius: borderRadius.sm,
                  transition: transitions.background.standard,
                  borderBottom:
                    index === recentActivity.length - 1
                      ? 'none'
                      : `1px solid ${alphaUtil(neutral[200], 0.5)}`,
                  '&:hover': {
                    bgcolor: alphaUtil(primary.main, opacity.subtle),
                  },
                }}
              >
                <Box
                  sx={{
                    p: spacing[2],
                    borderRadius: borderRadius.sm,
                    bgcolor: alphaUtil(getActivityStatusColor(activity.status), opacity.light),
                    color: getActivityStatusColor(activity.status),
                    mr: spacing[4],
                    transition: transitions.background.standard,
                  }}
                >
                  {activity.type === 'query' && <QueryStats fontSize="small" />}
                  {activity.type === 'patient' && <Person fontSize="small" />}
                  {activity.type === 'drug' && <Medication fontSize="small" />}
                  {activity.type === 'document' && <Description fontSize="small" />}
                </Box>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography
                    variant="body2"
                    sx={{
                      fontWeight: 500,
                      color: 'text.primary',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {activity.description}
                  </Typography>
                  <Typography
                    variant="caption"
                    sx={{
                      color: 'text.secondary',
                      mt: 0.25,
                      display: 'block',
                    }}
                  >
                    {activity.time}
                  </Typography>
                </Box>
                <Chip
                  label={activity.status}
                  size="small"
                  sx={{
                    borderRadius: borderRadius.xs,
                    fontWeight: 500,
                    textTransform: 'capitalize',
                    ...(activity.status === 'warning'
                      ? {
                          bgcolor: alphaUtil(semantic.warning.main, opacity.medium),
                          color: semantic.warning.dark,
                        }
                      : {
                          bgcolor: alphaUtil(semantic.success.main, opacity.medium),
                          color: semantic.success.dark,
                        }),
                  }}
                />
              </Box>
            ))}
          </Paper>
        </Grid>

        {/* Right Sidebar */}
        <Grid item xs={12} md={4}>
          {/* Quick Actions */}
          <Paper
            sx={{
              p: spacing[6],
              mb: spacing[6],
              borderRadius: borderRadius.lg,
              boxShadow: componentShadows.card,
              transition: transitions.shadow.standard,
              '&:hover': {
                boxShadow: componentShadows.cardHover,
              },
            }}
          >
            <Typography
              variant="h6"
              sx={{
                fontWeight: 600,
                color: 'text.primary',
                mb: spacing[4],
              }}
            >
              Quick Actions
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: spacing[1] }}>
              {quickActions.map((action) => (
                <Box
                  key={action.label}
                  component="button"
                  tabIndex={0}
                  aria-label={action.label}
                  onClick={() => window.location.href = action.path}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      window.location.href = action.path;
                    }
                  }}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: spacing[4],
                    p: spacing[3],
                    borderRadius: borderRadius.sm,
                    cursor: 'pointer',
                    transition: `${transitions.background.standard}, ${transitions.transform.standard}`,
                    bgcolor: 'transparent',
                    border: '1px solid transparent',
                    '&:hover': {
                      bgcolor: alphaUtil(action.color, opacity.light),
                      borderColor: alphaUtil(action.color, opacity.medium),
                      transform: 'translateX(4px)',
                    },
                    '&:focus-visible': {
                      outline: `2px solid ${action.color}`,
                      outlineOffset: '2px',
                      bgcolor: alphaUtil(action.color, opacity.light),
                    },
                  }}
                >
                  <Box sx={{ color: action.color }}>{action.icon}</Box>
                  <Typography
                    variant="body2"
                    sx={{
                      fontWeight: 500,
                      color: 'text.primary',
                    }}
                  >
                    {action.label}
                  </Typography>
                </Box>
              ))}
            </Box>
          </Paper>

          {/* System Status */}
          <Paper
            sx={{
              p: spacing[6],
              borderRadius: borderRadius.lg,
              boxShadow: componentShadows.card,
              transition: transitions.shadow.standard,
              '&:hover': {
                boxShadow: componentShadows.cardHover,
              },
            }}
          >
            <Typography
              variant="h6"
              sx={{
                fontWeight: 600,
                color: 'text.primary',
                mb: spacing[4],
                display: 'flex',
                alignItems: 'center',
                gap: 0.5,
              }}
            >
              <CheckCircle sx={{ fontSize: 20, color: semantic.success.main }} />
              System Status
            </Typography>
            {Object.entries(services).map(([service, status], index, arr) => (
              <Box
                key={service}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  py: spacing[3],
                  px: spacing[2],
                  borderRadius: borderRadius.sm,
                  transition: transitions.background.standard,
                  borderBottom: index === arr.length - 1 ? 'none' : `1px solid ${theme.palette.divider}`,
                  '&:hover': {
                    bgcolor: alphaUtil(getServiceStatusColor(status), opacity.light),
                  },
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  {status === 'healthy' && (
                    <CheckCircle sx={{ fontSize: 16, color: semantic.success.main }} />
                  )}
                  <Typography
                    variant="body2"
                    sx={{
                      textTransform: 'capitalize',
                      color: 'text.primary',
                      fontWeight: 500,
                    }}
                  >
                    {service.replace(/_/g, ' ')}
                  </Typography>
                </Box>
                <Chip
                  label={status}
                  size="small"
                  sx={{
                    borderRadius: borderRadius.xs,
                    fontWeight: 500,
                    textTransform: 'capitalize',
                    ...(status === 'healthy'
                      ? {
                          bgcolor: alphaUtil(semantic.success.main, opacity.medium),
                          color: semantic.success.dark,
                          boxShadow: clinicalShadows.success,
                        }
                      : status === 'degraded'
                        ? {
                            bgcolor: alphaUtil(semantic.warning.main, opacity.medium),
                            color: semantic.warning.dark,
                            boxShadow: clinicalShadows.warning,
                          }
                        : {
                            bgcolor: alphaUtil(semantic.error.main, opacity.medium),
                            color: semantic.error.dark,
                          }),
                  }}
                />
              </Box>
            ))}
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}
