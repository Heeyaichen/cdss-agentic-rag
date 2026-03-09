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
} from '@mui/material';
import { Search } from '@mui/icons-material';
import { useMutation } from '@tanstack/react-query';
import { clinicalApi } from '@/lib/api-client';
import { PubMedArticle } from '@/lib/types';

export default function LiteraturePage() {
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

  return (
    <Box>
      <Typography variant="h4" gutterBottom fontWeight={600}>
        Medical Literature Search
      </Typography>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={2}>
            <Grid item xs={12} md={8}>
              <TextField
                fullWidth
                label="Search Query"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="Enter search terms..."
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
                sx={{ height: '100%' }}
              >
                Search
              </Button>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {searchLiterature.isPending && <LinearProgress sx={{ mb: 2 }} />}

      {searchLiterature.data && (
        <Paper>
          <Box sx={{ p: 2 }}>
            <Typography variant="h6">
              Results ({searchLiterature.data.papers?.length || 0} articles)
            </Typography>
          </Box>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>PMID</TableCell>
                <TableCell>Title</TableCell>
                <TableCell>Journal</TableCell>
                <TableCell>Date</TableCell>
                <TableCell>Relevance</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {(searchLiterature.data.papers || []).map(
                (article: PubMedArticle) => (
                  <TableRow key={article.pmid} hover>
                    <TableCell>
                      <Typography variant="body2" fontWeight={600}>
                        {article.pmid}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">{article.title}</Typography>
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                        }}
                      >
                        {article.abstract}
                      </Typography>
                    </TableCell>
                    <TableCell>{article.journal}</TableCell>
                    <TableCell>{article.publication_date}</TableCell>
                    <TableCell>
                      <Chip
                        label="High"
                        size="small"
                        color="success"
                        variant="outlined"
                      />
                    </TableCell>
                  </TableRow>
                )
              )}
            </TableBody>
          </Table>
        </Paper>
      )}
    </Box>
  );
}
