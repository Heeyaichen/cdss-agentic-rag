import React from 'react';
import { Alert, AlertTitle, Box, Chip, Typography } from '@mui/material';
import { Warning, Error, Info } from '@mui/icons-material';
import { DrugAlert } from '@/lib/types';

interface DrugAlertBannerProps {
  alerts: DrugAlert[];
}

export default function DrugAlertBanner({ alerts }: DrugAlertBannerProps) {
  if (!alerts || alerts.length === 0) return null;

  const majorAlerts = alerts.filter((a) => a.severity === 'major');
  const moderateAlerts = alerts.filter((a) => a.severity === 'moderate');
  const minorAlerts = alerts.filter((a) => a.severity === 'minor');

  return (
    <Box>
      {majorAlerts.length > 0 && (
        <Alert severity="error" sx={{ mb: 2 }}>
          <AlertTitle>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Error />
              Major Drug Interactions ({majorAlerts.length})
            </Box>
          </AlertTitle>
          {majorAlerts.map((alert, i) => (
            <Box key={i} sx={{ mt: 1 }}>
              <Typography variant="body2" fontWeight={600}>
                {alert.description}
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, mt: 0.5 }}>
                <Chip label={alert.source} size="small" />
                <Chip
                  label={`Evidence Level: ${alert.evidence_level}`}
                  size="small"
                  variant="outlined"
                />
              </Box>
              {alert.alternatives.length > 0 && (
                <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                  Alternatives: {alert.alternatives.join(', ')}
                </Typography>
              )}
            </Box>
          ))}
        </Alert>
      )}

      {moderateAlerts.length > 0 && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          <AlertTitle>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Warning />
              Moderate Drug Interactions ({moderateAlerts.length})
            </Box>
          </AlertTitle>
          {moderateAlerts.map((alert, i) => (
            <Typography key={i} variant="body2">
              {alert.description}
            </Typography>
          ))}
        </Alert>
      )}

      {minorAlerts.length > 0 && (
        <Alert severity="info" sx={{ mb: 2 }}>
          <AlertTitle>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Info />
              Minor Drug Interactions ({minorAlerts.length})
            </Box>
          </AlertTitle>
          {minorAlerts.map((alert, i) => (
            <Typography key={i} variant="body2">
              {alert.description}
            </Typography>
          ))}
        </Alert>
      )}
    </Box>
  );
}
