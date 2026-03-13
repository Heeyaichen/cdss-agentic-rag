import React, { useState, useCallback } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Grid,
  Paper,
  LinearProgress,
  Alert,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  useTheme,
  alpha,
  CircularProgress,
  Snackbar,
  IconButton,
} from '@mui/material';
import {
  CloudUpload,
  Description,
  CheckCircle,
  Error,
  HourglassEmpty,
  Delete,
  CloudDone,
  UploadFile,
} from '@mui/icons-material';
import { useMutation } from '@tanstack/react-query';
import { clinicalApi } from '@/lib/api-client';
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

export default function DocumentUploadPage() {
  const theme = useTheme();
  const [files, setFiles] = useState<File[]>([]);
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false,
    message: '',
    severity: 'success',
  });

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      return clinicalApi.ingestDocument(file, 'clinical_document');
    },
  });

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const droppedFiles = Array.from(e.dataTransfer.files);
    setFiles((prev) => [...prev, ...droppedFiles]);
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files);
      setFiles((prev) => [...prev, ...selectedFiles]);
    }
  };

  const handleRemoveFile = (fileName: string) => {
    setFiles((prev) => prev.filter((f) => f.name !== fileName));
    setUploadProgress((prev) => {
      const newProgress = { ...prev };
      delete newProgress[fileName];
      return newProgress;
    });
  };

  const handleUpload = async () => {
    for (const file of files) {
      setUploadProgress((prev) => ({ ...prev, [file.name]: 0 }));
      try {
        await uploadMutation.mutateAsync(file);
        setUploadProgress((prev) => ({ ...prev, [file.name]: 100 }));
      } catch {
        setUploadProgress((prev) => ({ ...prev, [file.name]: -1 }));
      }
    }
    setSnackbar({
      open: true,
      message: 'All files processed successfully!',
      severity: 'success',
    });
  };

  const getStatusIcon = (fileName: string) => {
    const progress = uploadProgress[fileName];
    if (progress === undefined) return <Description sx={{ color: neutral[400] }} />;
    if (progress === -1) return <Error sx={{ color: semantic.error.main }} />;
    if (progress === 100) return <CheckCircle sx={{ color: semantic.success.main }} />;
    return <CircularProgress size={16} sx={{ color: primary.main }} />;
  };

  const getStatusColor = (fileName: string) => {
    const progress = uploadProgress[fileName];
    if (progress === undefined) return neutral[100];
    if (progress === -1) return semantic.error.bgLight;
    if (progress === 100) return semantic.success.bgLight;
    return alpha(primary.main, 0.08);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    if (bytes < 1024) return `${bytes} Bytes`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const totalFiles = files.length;
  const completedFiles = Object.values(uploadProgress).filter((p) => p === 100).length;
  const hasErrors = Object.values(uploadProgress).some((p) => p === -1);

  return (
    <Box>
      {/* Header */}
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
          Document Upload
        </Typography>
        <Typography variant="body2" sx={{ color: neutral[500] }}>
          Upload clinical documents for AI-powered analysis and indexing
        </Typography>
      </Box>

      {/* Upload Zone */}
      <Card
        sx={{
          mb: spacing[6],
          borderRadius: borderRadius.lg,
          boxShadow: componentShadows.card,
          border: `1px solid ${neutral[200]}`,
          transition: transitions.shadow.standard,
        }}
      >
        <CardContent
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          sx={{
            border: `2px dashed ${neutral[300]}`,
            borderRadius: borderRadius.md,
            textAlign: 'center',
            py: spacing[16],
            px: spacing[4],
            cursor: 'pointer',
            backgroundColor: neutral[50],
            transition: transitions.all.standard,
            '&:hover': {
              borderColor: primary.main,
              backgroundColor: alpha(primary.main, 0.04),
            },
            '&:active': {
              borderColor: primary.dark,
            },
          }}
        >
          <Box
            sx={{
              width: 80,
              height: 80,
              borderRadius: borderRadius.full,
              backgroundColor: alpha(primary.main, 0.1),
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              mx: 'auto',
              mb: spacing[4],
            }}
          >
            <CloudUpload sx={{ fontSize: 40, color: primary.main }} />
          </Box>

          <Typography variant="h6" gutterBottom fontWeight={600} sx={{ color: neutral[800] }}>
            Drag and drop files here
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: spacing[3] }}>
            or
          </Typography>
          <Button
            variant="contained"
            component="label"
            startIcon={<UploadFile />}
            sx={{
              borderRadius: borderRadius.sm,
              px: spacing[6],
              py: spacing[2],
              fontWeight: 500,
              textTransform: 'none',
            }}
          >
            Browse Files
            <input
              type="file"
              hidden
              multiple
              accept=".pdf,.doc,.docx,.txt,.jpg,.png"
              onChange={handleFileSelect}
            />
          </Button>

          <Typography
            variant="caption"
            sx={{
              display: 'block',
              color: neutral[500],
              mt: spacing[4],
            }}
          >
            Supported formats: PDF, DOC, DOCX, TXT, JPG, PNG
          </Typography>
        </CardContent>
      </Card>

      {/* Selected Files */}
      {files.length > 0 && (
        <Paper
          sx={{
            p: spacing[4],
            mb: spacing[6],
            borderRadius: borderRadius.lg,
            boxShadow: componentShadows.card,
            border: `1px solid ${neutral[200]}`,
          }}
        >
          {/* Progress Summary */}
          <Box
            sx={{
              p: spacing[4],
              borderBottom: `1px solid ${neutral[200]}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <Box>
              <Typography variant="h6" fontWeight={600} sx={{ color: neutral[900] }}>
                Selected Files
              </Typography>
              <Typography variant="caption" sx={{ color: neutral[500] }}>
                {completedFiles} of {totalFiles} processed
                {hasErrors && <Box component="span" sx={{ color: semantic.error.main, ml: spacing[1] }}>(some failed)</Box>}
              </Typography>
            </Box>
            <Button
              variant="text"
              size="small"
              onClick={() => setFiles([])}
              sx={{ color: neutral[500] }}
            >
              Clear All
            </Button>
          </Box>

          {/* File List */}
          <List sx={{ px: spacing[2], py: spacing[2] }}>
            {files.map((file, i) => (
              <ListItem
                key={i}
                sx={{
                  borderRadius: borderRadius.sm,
                  mb: spacing[1],
                  backgroundColor: getStatusColor(file.name),
                  transition: transitions.background.fast,
                }}
                secondaryAction={
                  uploadProgress[file.name] === undefined && (
                    <IconButton
                      size="small"
                      onClick={() => handleRemoveFile(file.name)}
                      sx={{ color: neutral[400] }}
                    >
                      <Delete fontSize="small" />
                    </IconButton>
                  )
                }
              >
                <ListItemIcon>
                  {getStatusIcon(file.name)}
                </ListItemIcon>
                <ListItemText
                  primary={
                    <Typography
                      variant="body2"
                      fontWeight={500}
                      sx={{ color: neutral[800] }}
                    >
                      {file.name}
                    </Typography>
                  }
                  secondary={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: spacing[1] }}>
                      <Typography variant="caption" sx={{ color: neutral[500] }}>
                        {formatFileSize(file.size)}
                      </Typography>
                      {uploadProgress[file.name] === 100 && (
                        <CheckCircle sx={{ fontSize: 14, color: semantic.success.main }} />
                      )}
                      {uploadProgress[file.name] === -1 && (
                        <Error sx={{ fontSize: 14, color: semantic.error.main }} />
                      )}
                    </Box>
                  }
                />
                {/* Progress Bar */}
                {uploadProgress[file.name] !== undefined &&
                  uploadProgress[file.name] > 0 &&
                  uploadProgress[file.name] < 100 && (
                    <Box sx={{ width: '100%', px: spacing[4] }}>
                      <LinearProgress
                        variant="determinate"
                        value={uploadProgress[file.name]}
                        sx={{
                          height: 4,
                          borderRadius: borderRadius.full,
                          backgroundColor: neutral[200],
                          '& .MuiLinearProgress-bar': {
                            backgroundColor: primary.main,
                            borderRadius: borderRadius.full,
                          },
                        }}
                      />
                    </Box>
                  )}
              </ListItem>
            ))}
          </List>

          {/* Upload Button */}
          <Box sx={{ p: spacing[4], borderTop: `1px solid ${neutral[200]}` }}>
            <Button
              variant="contained"
              size="large"
              startIcon={<CloudDone />}
              onClick={handleUpload}
              disabled={uploadMutation.isPending || files.length === 0}
              sx={{
                borderRadius: borderRadius.sm,
                px: spacing[6],
                fontWeight: 500,
                textTransform: 'none',
              }}
            >
              {uploadMutation.isPending ? 'Uploading...' : `Upload ${files.length} File${files.length > 1 ? 's' : ''}`}
            </Button>
          </Box>
        </Paper>
      )}

      {/* Error Alert */}
      {uploadMutation.isError && (
        <Alert
          severity="error"
          sx={{
            mt: spacing[4],
            borderRadius: borderRadius.sm,
            boxShadow: shadows[1],
          }}
        >
          Failed to upload document. Please check the file format and try again.
        </Alert>
      )}

      {/* Snackbar for success */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          severity={snackbar.severity}
          sx={{
            borderRadius: borderRadius.md,
            boxShadow: componentShadows.snackbar,
          }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
