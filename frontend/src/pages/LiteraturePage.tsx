import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Grid,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Chip,
  LinearProgress,
  Skeleton,
  Link,
  useTheme,
  alpha,
} from '@mui/material';
import { Search, Article, Science, Schedule, Link as LinkIcon } from '@mui/icons-material';
import { useMutation } from '@tanstack/react-query';
import { clinicalApi } from '@/lib/api-client';
import { PubMedArticle } from '@/lib/types';
import {
  spacing,
  borderRadius,
  shadows,
  transitions,
  primary,
  semantic,
  neutral,
  clinical,
} from '@/theme';
import { componentShadows } from '@/theme/shadows';

export default function LiteraturePage() {
  const theme = useTheme();
  const [query, setQuery] = useState('');
  const [maxResults, setMaxResults] = useState(10);

  const searchLiterature = useMutation({
    mutationFn: () =>
      clinicalApi.searchLiterature({
        query,
        max_results: maxResults,
      }),
  });

  const handleSearch = () => {
    if (query.trim()) {
      searchLiterature.mutate();
    }
  };

  const getRelevanceColor = (score: number) => {
    if (score >= 0.8) return clinical.evidenceQuality.high;
    if (score >= 0.5) return clinical.evidenceQuality.moderate;
    return clinical.evidenceQuality.low;
  };

  return (
    <Box>
      <Box sx={{ mb: spacing[6] }}>
        <Typography
          variant="h4"
          fontWeight={600}
          sx={{
            mb: spacing[1],
            color: neutral[900],
            letterSpacing: '-0.015em',
          }}
        >
          Medical Literature Search
        </Typography>
        <Typography
          variant="body2"
          sx={{ color: neutral[500] }}
        >
          Search PubMed and indexed medical literature for clinical evidence
        </Typography>
      </Box>

      {/* Search Card */}
      <Card
        sx={{
          mb: spacing[6],
          borderRadius: borderRadius.lg,
          boxShadow: componentShadows.card,
          transition: transitions.shadow.standard,
          border: `1px solid ${neutral[200]}`,
        }}
      >
        <CardContent sx={{ p: spacing[6] }}>
          <Grid container spacing={spacing[4]}>
            <Grid item xs={12} md={8}>
              <TextField
                fullWidth
                label="Search Query"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="Enter MeSH terms, keywords, or clinical concepts..."
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: borderRadius.sm,
                    transition: transitions.border.standard,
                    '&:hover': {
                      borderColor: primary.main,
                    },
                    '&.Mui-focused': {
                      boxShadow: `0 0 0 3px ${alpha(primary.main, 0.12)}`,
                    },
                  },
                }}
                InputProps={{
                  startAdornment: (
                    <Search sx={{ color: neutral[400], mr: spacing[1] }} />
                  ),
                }}
              />
            </Grid>
            <Grid item xs={6} md={2}>
              <TextField
                fullWidth
                type="number"
                label="Max Results"
                value={maxResults}
                onChange={(e) => setMaxResults(Number(e.target.value))}
                inputProps={{ min: 1, max: 50 }}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: borderRadius.sm,
                  },
                }}
              />
            </Grid>
            <Grid item xs={6} md={2}>
              <Button
                fullWidth
                variant="contained"
                size="large"
                startIcon={<Search />}
                onClick={handleSearch}
                disabled={!query.trim() || searchLiterature.isPending}
                sx={{
                  height: '100%',
                  minHeight: spacing[12],
                  borderRadius: borderRadius.sm,
                  fontWeight: 600,
                  textTransform: 'none',
                  backgroundColor: primary.main,
                  boxShadow: shadows[1],
                  transition: transitions.interactive,
                  '&:hover': {
                    backgroundColor: primary.dark,
                    boxShadow: shadows[2],
                  },
                  '&:disabled': {
                    backgroundColor: neutral[300],
                  },
                }}
              >
                Search
              </Button>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Loading State */}
      {searchLiterature.isPending && (
        <Card
          sx={{
            mb: spacing[4],
            borderRadius: borderRadius.md,
            boxShadow: componentShadows.card,
            overflow: 'hidden',
          }}
        >
          <LinearProgress
            sx={{
              height: 4,
              backgroundColor: alpha(primary.main, 0.1),
              '& .MuiLinearProgress-bar': {
                backgroundColor: primary.main,
              },
            }}
          />
          <CardContent sx={{ p: spacing[6] }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: spacing[2], mb: spacing[4] }}>
              <Skeleton variant="circular" width={24} height={24} />
              <Skeleton variant="text" width={200} height={28} />
            </Box>
            {[1, 2, 3].map((i) => (
              <Box key={i} sx={{ mb: spacing[4] }}>
                <Skeleton variant="text" width="60%" height={20} />
                <Skeleton variant="text" width="100%" height={16} />
                <Skeleton variant="text" width="40%" height={16} />
              </Box>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Results */}
      {searchLiterature.data && !searchLiterature.isPending && (
        <Paper
          sx={{
            borderRadius: borderRadius.lg,
            boxShadow: componentShadows.card,
            overflow: 'hidden',
            border: `1px solid ${neutral[200]}`,
          }}
        >
          {/* Results Header */}
          <Box
            sx={{
              p: spacing[4],
              borderBottom: `1px solid ${neutral[200]}`,
              backgroundColor: alpha(primary.main, 0.04),
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: spacing[2] }}>
              <Article sx={{ color: primary.main }} />
              <Typography
                variant="h6"
                fontWeight={600}
                sx={{ color: neutral[900] }}
              >
                Search Results
              </Typography>
            </Box>
            <Chip
              label={`${searchLiterature.data.papers?.length || 0} articles`}
              size="small"
              sx={{
                backgroundColor: alpha(primary.main, 0.1),
                color: primary.dark,
                fontWeight: 500,
                borderRadius: borderRadius.xs,
              }}
            />
          </Box>

          {/* Results Table */}
          <Table>
            <TableHead>
              <TableRow
                sx={{
                  backgroundColor: neutral[50],
                  '& .MuiTableCell-root': {
                    fontWeight: 600,
                    color: neutral[700],
                    borderBottom: `2px solid ${neutral[200]}`,
                    py: spacing[3],
                    px: spacing[4],
                  },
                }}
              >
                <TableCell sx={{ width: 100 }}>PMID</TableCell>
                <TableCell>Title & Abstract</TableCell>
                <TableCell sx={{ width: 150 }}>Journal</TableCell>
                <TableCell sx={{ width: 120 }}>Date</TableCell>
                <TableCell sx={{ width: 100 }}>Relevance</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {(searchLiterature.data.papers || []).map(
                (article: PubMedArticle, index: number) => (
                  <TableRow
                    key={article.pmid}
                    hover
                    sx={{
                      transition: transitions.background.fast,
                      '&:hover': {
                        backgroundColor: alpha(primary.main, 0.04),
                      },
                      '& .MuiTableCell-root': {
                        py: spacing[4],
                        px: spacing[4],
                        borderBottom: `1px solid ${neutral[200]}`,
                      },
                    }}
                  >
                    {/* PMID */}
                    <TableCell>
                      <Link
                        href={`https://pubmed.ncbi.nlm.nih.gov/${article.pmid}/`}
                        target="_blank"
                        rel="noopener noreferrer"
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: spacing[1],
                          fontWeight: 600,
                          color: primary.main,
                          textDecoration: 'none',
                          transition: transitions.color.fast,
                          '&:hover': {
                            color: primary.dark,
                            textDecoration: 'underline',
                          },
                        }}
                      >
                        <LinkIcon fontSize="small" />
                        {article.pmid}
                      </Link>
                    </TableCell>

                    {/* Title & Abstract */}
                    <TableCell>
                      <Typography
                        variant="body2"
                        fontWeight={600}
                        sx={{
                          color: neutral[900],
                          mb: spacing[1],
                          lineHeight: 1.4,
                        }}
                      >
                        {article.title}
                      </Typography>
                      <Typography
                        variant="caption"
                        sx={{
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                          color: neutral[500],
                          lineHeight: 1.5,
                        }}
                      >
                        {article.abstract}
                      </Typography>
                    </TableCell>

                    {/* Journal */}
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: spacing[1] }}>
                        <Science sx={{ fontSize: 16, color: neutral[400] }} />
                        <Typography
                          variant="body2"
                          sx={{
                            color: neutral[600],
                            fontSize: '0.8rem',
                          }}
                        >
                          {article.journal}
                        </Typography>
                      </Box>
                    </TableCell>

                    {/* Date */}
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: spacing[1] }}>
                        <Schedule sx={{ fontSize: 16, color: neutral[400] }} />
                        <Typography
                          variant="body2"
                          sx={{ color: neutral[600] }}
                        >
                          {article.publication_date}
                        </Typography>
                      </Box>
                    </TableCell>

                    {/* Relevance Score */}
                    <TableCell>
                      <Chip
                        label="High"
                        size="small"
                        sx={{
                          backgroundColor: alpha(clinical.evidenceQuality.high, 0.1),
                          color: clinical.evidenceQuality.high,
                          fontWeight: 600,
                          borderRadius: borderRadius.xs,
                          fontSize: '0.75rem',
                        }}
                      />
                    </TableCell>
                  </TableRow>
                )
              )}
            </TableBody>
          </Table>

          {/* Empty State */}
          {(!searchLiterature.data.papers || searchLiterature.data.papers.length === 0) && (
            <Box
              sx={{
                p: spacing[12],
                textAlign: 'center',
                color: neutral[500],
              }}
            >
              <Article sx={{ fontSize: 48, color: neutral[300], mb: spacing[2] }} />
              <Typography variant="body1" fontWeight={500}>
                No articles found
              </Typography>
              <Typography variant="body2" sx={{ mt: spacing[1] }}>
                Try adjusting your search terms or expanding the date range
              </Typography>
            </Box>
          )}
        </Paper>
      )}
    </Box>
  );
}
