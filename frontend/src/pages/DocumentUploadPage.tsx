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
} from '@mui/material';
import {
  CloudUpload,
  Description,
  CheckCircle,
  Error,
  HourglassEmpty,
} from '@mui/icons-material';
import { useMutation } from '@tanstack/react-query';
import { clinicalApi } from '@/lib/api-client';
import { DocumentIngestResponse } from '@/lib/types';

export default function DocumentUploadPage() {
  const [files, setFiles] = useState<File[]>([]);
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>(
    {}
  );

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
  };

  const getStatusIcon = (fileName: string) => {
    const progress = uploadProgress[fileName];
    if (progress === undefined) return <Description />;
    if (progress === -1) return <Error color="error" />;
    if (progress === 100) return <CheckCircle color="success" />;
    return <HourglassEmpty color="primary" />;
  };

  return (
    <Box>
      <Typography variant="h4" gutterBottom fontWeight={600}>
        Document Upload
      </Typography>

      <Card sx={{ mb: 3 }}>
        <CardContent
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          sx={{
            border: '2px dashed',
            borderColor: 'divider',
            borderRadius: 2,
            textAlign: 'center',
            py: 6,
            cursor: 'pointer',
            '&:hover': {
              borderColor: 'primary.main',
              backgroundColor: 'action.hover',
            },
          }}
        >
          <CloudUpload sx={{ fontSize: 64, color: 'primary.main', mb: 2 }} />
          <Typography variant="h6" gutterBottom>
            Drag and drop files here
          </Typography>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            or
          </Typography>
          <Button variant="contained" component="label">
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
            display="block"
            color="text.secondary"
            sx={{ mt: 2 }}
          >
            Supported formats: PDF, DOC, DOCX, TXT, JPG, PNG
          </Typography>
        </CardContent>
      </Card>

      {files.length > 0 && (
        <Paper sx={{ p: 2, mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            Selected Files ({files.length})
          </Typography>
          <List>
            {files.map((file, i) => (
              <ListItem key={i}>
                <ListItemIcon>{getStatusIcon(file.name)}</ListItemIcon>
                <ListItemText
                  primary={file.name}
                  secondary={`${(file.size / 1024).toFixed(2)} KB`}
                />
                {uploadProgress[file.name] !== undefined &&
                  uploadProgress[file.name] > 0 &&
                  uploadProgress[file.name] < 100 && (
                    <Box sx={{ width: '100%', mr: 1 }}>
                      <LinearProgress
                        variant="determinate"
                        value={uploadProgress[file.name]}
                      />
                    </Box>
                  )}
              </ListItem>
            ))}
          </List>
          <Button
            variant="contained"
            size="large"
            onClick={handleUpload}
            disabled={uploadMutation.isPending}
            sx={{ mt: 2 }}
          >
            Upload All
          </Button>
        </Paper>
      )}

      {uploadMutation.isError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          Failed to upload document. Please try again.
        </Alert>
      )}

      {uploadMutation.isSuccess && (
        <Alert severity="success" sx={{ mb: 2 }}>
          Document uploaded successfully!
        </Alert>
      )}
    </Box>
  );
}
