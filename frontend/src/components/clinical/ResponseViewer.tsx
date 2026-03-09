import React from 'react';
import {
  Card,
  CardContent,
  Typography,
  Box,
  Chip,
  Divider,
  LinearProgress,
  Paper,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Link,
} from '@mui/material';
import { ExpandMore, Science, LocalHospital, Description } from '@mui/icons-material';
import { ClinicalResponse, Citation } from '@/lib/types';

interface ResponseViewerProps {
  response: ClinicalResponse;
}

export default function ResponseViewer({ response }: ResponseViewerProps) {
  const getSourceIcon = (sourceType: string) => {
    switch (sourceType) {
      case 'pubmed':
        return <Science fontSize="small" />;
      case 'guideline':
        return <LocalHospital fontSize="small" />;
      default:
        return <Description fontSize="small" />;
    }
  };

  return (
    <Card sx={{ mt: 3 }}>
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6">Clinical Response</Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="body2" color="text.secondary">
              Confidence:
            </Typography>
            <Box sx={{ width: 100, mr: 1 }}>
              <LinearProgress
                variant="determinate"
                value={response.confidence_score * 100}
                color={
                  response.confidence_score >= 0.8
                    ? 'success'
                    : response.confidence_score >= 0.6
                    ? 'warning'
                    : 'error'
                }
              />
            </Box>
            <Typography variant="body2" fontWeight={600}>
              {Math.round(response.confidence_score * 100)}%
            </Typography>
          </Box>
        </Box>

        <Paper variant="outlined" sx={{ p: 2, mb: 2, bgcolor: 'background.default' }}>
          <Typography variant="subtitle2" color="text.secondary" gutterBottom>
            Assessment
          </Typography>
          <Typography variant="body1">{response.assessment}</Typography>
        </Paper>

        <Paper
          variant="outlined"
          sx={{
            p: 2,
            mb: 2,
            bgcolor: 'primary.main',
            color: 'primary.contrastText',
          }}
        >
          <Typography variant="subtitle2" gutterBottom sx={{ opacity: 0.9 }}>
            Recommendation
          </Typography>
          <Typography variant="body1" fontWeight={500}>
            {response.recommendation}
          </Typography>
        </Paper>

        {response.evidence_summary.length > 0 && (
          <Box sx={{ mb: 2 }}>
            <Typography variant="subtitle2" gutterBottom>
              Evidence Summary
            </Typography>
            <Box component="ul" sx={{ pl: 2 }}>
              {response.evidence_summary.map((evidence, i) => (
                <Typography component="li" key={i} variant="body2" sx={{ mb: 0.5 }}>
                  {evidence}
                </Typography>
              ))}
            </Box>
          </Box>
        )}

        {response.citations.length > 0 && (
          <Box sx={{ mb: 2 }}>
            <Typography variant="subtitle2" gutterBottom>
              Citations ({response.citations.length})
            </Typography>
            {response.citations.map((citation, i) => (
              <Accordion key={i} sx={{ mb: 1 }}>
                <AccordionSummary expandIcon={<ExpandMore />}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {getSourceIcon(citation.source_type)}
                    <Typography variant="body2">
                      {citation.title}
                    </Typography>
                    <Chip
                      label={citation.source_type}
                      size="small"
                      variant="outlined"
                    />
                  </Box>
                </AccordionSummary>
                <AccordionDetails>
                  <Typography variant="body2" color="text.secondary">
                    Identifier: {citation.identifier}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Relevance: {Math.round(citation.relevance_score * 100)}%
                  </Typography>
                  {citation.url && (
                    <Link href={citation.url} target="_blank" rel="noopener">
                      View Source
                    </Link>
                  )}
                </AccordionDetails>
              </Accordion>
            ))}
          </Box>
        )}

        {response.disclaimers.length > 0 && (
          <Box sx={{ mt: 2, p: 2, bgcolor: 'warning.light', borderRadius: 1 }}>
            <Typography variant="subtitle2" color="warning.dark" gutterBottom>
              Disclaimers
            </Typography>
            {response.disclaimers.map((disclaimer, i) => (
              <Typography key={i} variant="caption" display="block" color="warning.dark">
                • {disclaimer}
              </Typography>
            ))}
          </Box>
        )}

        <Divider sx={{ my: 2 }} />

        <Box>
          <Typography variant="subtitle2" gutterBottom>
            Agent Outputs
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            {Object.entries(response.agent_outputs).map(([agent, output]) => (
              <Chip
                key={agent}
                label={`${agent}: ${output.latency_ms}ms`}
                size="small"
                variant="outlined"
              />
            ))}
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
}
