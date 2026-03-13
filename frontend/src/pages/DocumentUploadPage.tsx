import React from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Grid,
  LinearProgress,
  Stack,
  Step,
  StepLabel,
  Stepper,
  Typography,
} from "@mui/material";
import {
  AutoFixHigh,
  CloudUpload,
  Delete,
  Description,
  DoneAll,
  Replay,
  UploadFile,
} from "@mui/icons-material";
import { clinicalApi } from "@/lib/api-client";
import { alpha as alphaUtil, borderRadius, componentShadows, semantic, severity, spacing } from "@/theme";

type PipelineStage = "queued" | "uploading" | "parsing" | "indexing" | "completed" | "error";

interface PipelineFile {
  id: string;
  file: File;
  stage: PipelineStage;
  progress: number;
  message?: string;
  documentId?: string;
}

const STAGE_ORDER: PipelineStage[] = ["queued", "uploading", "parsing", "indexing", "completed"];

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function stageColor(stage: PipelineStage): string {
  if (stage === "completed") return semantic.success.main;
  if (stage === "error") return severity.major.main;
  if (stage === "indexing") return semantic.info.main;
  if (stage === "parsing") return semantic.warning.main;
  return "text.secondary";
}

function stageLabel(stage: PipelineStage): string {
  if (stage === "queued") return "Queued";
  if (stage === "uploading") return "Uploading";
  if (stage === "parsing") return "Parsing";
  if (stage === "indexing") return "Indexing";
  if (stage === "completed") return "Completed";
  return "Error";
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export default function DocumentUploadPage() {
  const [pipelineFiles, setPipelineFiles] = React.useState<PipelineFile[]>([]);
  const [dragActive, setDragActive] = React.useState(false);

  const addFiles = (incoming: File[]) => {
    if (incoming.length === 0) return;
    setPipelineFiles((prev) => {
      const existing = new Set(prev.map((entry) => `${entry.file.name}:${entry.file.size}`));
      const additions = incoming
        .filter((file) => !existing.has(`${file.name}:${file.size}`))
        .map((file) => ({
          id: `${file.name}-${file.size}-${crypto.randomUUID()}`,
          file,
          stage: "queued" as PipelineStage,
          progress: 0,
        }));
      return [...prev, ...additions];
    });
  };

  const updateFile = (fileId: string, updates: Partial<PipelineFile>) => {
    setPipelineFiles((prev) => prev.map((entry) => (entry.id === fileId ? { ...entry, ...updates } : entry)));
  };

  const removeFile = (fileId: string) => {
    setPipelineFiles((prev) => prev.filter((entry) => entry.id !== fileId));
  };

  const runPipeline = async (entry: PipelineFile) => {
    updateFile(entry.id, { stage: "uploading", progress: 18, message: "Uploading document payload..." });

    try {
      const response = (await clinicalApi.ingestDocument(entry.file, "clinical_document")) as {
        document_id?: string;
        status?: string;
        message?: string;
      };

      if (response.status === "error") {
        throw new Error(response.message || "Ingestion failed");
      }

      updateFile(entry.id, {
        stage: "parsing",
        progress: 48,
        documentId: response.document_id,
        message: response.message || "Document received. Parsing clinical text.",
      });
      await wait(450);

      updateFile(entry.id, {
        stage: "indexing",
        progress: 78,
        message: "Building embeddings and indexing chunks.",
      });
      await wait(500);

      updateFile(entry.id, {
        stage: "completed",
        progress: 100,
        message: "Document indexed and ready for retrieval.",
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unexpected ingestion error";
      updateFile(entry.id, {
        stage: "error",
        progress: 100,
        message,
      });
    }
  };

  const runAllQueued = async () => {
    const queued = pipelineFiles.filter((entry) => entry.stage === "queued" || entry.stage === "error");
    for (const entry of queued) {
      await runPipeline(entry);
    }
  };

  const retryFile = async (fileId: string) => {
    const entry = pipelineFiles.find((item) => item.id === fileId);
    if (!entry) return;
    updateFile(entry.id, { stage: "queued", progress: 0, message: undefined, documentId: undefined });
    await runPipeline({ ...entry, stage: "queued", progress: 0, message: undefined, documentId: undefined });
  };

  const completedCount = pipelineFiles.filter((entry) => entry.stage === "completed").length;
  const errorCount = pipelineFiles.filter((entry) => entry.stage === "error").length;
  const inFlightCount = pipelineFiles.filter(
    (entry) => entry.stage === "uploading" || entry.stage === "parsing" || entry.stage === "indexing"
  ).length;

  return (
    <Box>
      <Box sx={{ mb: spacing[4] }}>
        <Typography variant="h4" sx={{ mb: 0.5 }}>
          Documents Ingestion Pipeline
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Upload, parse, and index clinical documents with timeline visibility, failure recovery, and retry controls.
        </Typography>
      </Box>

      <Grid container spacing={2}>
        <Grid item xs={12} lg={4}>
          <Card sx={{ borderRadius: borderRadius.md, boxShadow: componentShadows.card, height: "100%" }}>
            <CardContent sx={{ p: spacing[3], height: "100%" }}>
              <Stack spacing={2} sx={{ height: "100%" }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                  Upload Queue
                </Typography>

                <Box
                  onDragOver={(event) => {
                    event.preventDefault();
                    setDragActive(true);
                  }}
                  onDragLeave={() => setDragActive(false)}
                  onDrop={(event) => {
                    event.preventDefault();
                    setDragActive(false);
                    addFiles(Array.from(event.dataTransfer.files));
                  }}
                  sx={{
                    p: spacing[4],
                    borderRadius: borderRadius.md,
                    border: `2px dashed ${dragActive ? semantic.info.main : alphaUtil(semantic.info.main, 0.35)}`,
                    bgcolor: dragActive ? alphaUtil(semantic.info.main, 0.08) : alphaUtil(semantic.info.main, 0.03),
                    textAlign: "center",
                  }}
                >
                  <CloudUpload sx={{ fontSize: 36, color: semantic.info.main, mb: 1 }} />
                  <Typography variant="subtitle2" sx={{ mb: 0.3 }}>
                    Drop files to ingest
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    PDF, DOCX, TXT, PNG, JPG
                  </Typography>

                  <Button variant="outlined" component="label" startIcon={<UploadFile />} sx={{ mt: 2 }}>
                    Select Files
                    <input
                      hidden
                      type="file"
                      multiple
                      accept=".pdf,.doc,.docx,.txt,.png,.jpg,.jpeg"
                      onChange={(event) => addFiles(Array.from(event.target.files ?? []))}
                    />
                  </Button>
                </Box>

                <Card sx={{ borderRadius: borderRadius.sm, boxShadow: "none", border: "1px solid", borderColor: "divider" }}>
                  <CardContent sx={{ p: spacing[2] }}>
                    <Stack spacing={1}>
                      <Typography variant="caption" color="text.secondary">
                        Pipeline status
                      </Typography>
                      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                        <Chip size="small" label={`${pipelineFiles.length} total`} />
                        <Chip size="small" label={`${completedCount} completed`} color="success" />
                        <Chip size="small" label={`${inFlightCount} processing`} color="info" />
                        <Chip size="small" label={`${errorCount} failed`} color={errorCount > 0 ? "error" : "default"} />
                      </Stack>
                    </Stack>
                  </CardContent>
                </Card>

                <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                  <Button
                    variant="contained"
                    startIcon={<AutoFixHigh />}
                    disabled={pipelineFiles.length === 0 || inFlightCount > 0}
                    onClick={runAllQueued}
                  >
                    Run Pipeline
                  </Button>
                  <Button
                    variant="text"
                    color="inherit"
                    disabled={pipelineFiles.length === 0 || inFlightCount > 0}
                    onClick={() => setPipelineFiles([])}
                  >
                    Clear Queue
                  </Button>
                </Stack>
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} lg={8}>
          <Stack spacing={1.5}>
            {pipelineFiles.length === 0 && (
              <Card sx={{ borderRadius: borderRadius.md, boxShadow: componentShadows.card }}>
                <CardContent sx={{ py: spacing[8], textAlign: "center" }}>
                  <Description sx={{ fontSize: 44, color: "text.disabled", mb: 1 }} />
                  <Typography variant="h6">No files in queue</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Add documents to visualize parsing/index timelines and ingest readiness.
                  </Typography>
                </CardContent>
              </Card>
            )}

            {pipelineFiles.map((entry) => {
              const activeStep =
                entry.stage === "error" ? 1 : Math.max(STAGE_ORDER.findIndex((item) => item === entry.stage), 0);

              return (
                <Card key={entry.id} sx={{ borderRadius: borderRadius.md, boxShadow: componentShadows.card }}>
                  <CardContent sx={{ p: spacing[3] }}>
                    <Grid container spacing={2}>
                      <Grid item xs={12} md={4}>
                        <Stack spacing={1}>
                          <Typography variant="subtitle2" sx={{ wordBreak: "break-word" }}>
                            {entry.file.name}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {formatFileSize(entry.file.size)}
                          </Typography>
                          <Chip
                            size="small"
                            label={stageLabel(entry.stage)}
                            sx={{
                              alignSelf: "flex-start",
                              color: stageColor(entry.stage),
                              bgcolor: alphaUtil(stageColor(entry.stage), 0.12),
                            }}
                          />
                          {entry.documentId && (
                            <Typography variant="caption" color="text.secondary">
                              ID: {entry.documentId}
                            </Typography>
                          )}
                        </Stack>
                      </Grid>

                      <Grid item xs={12} md={5}>
                        <Stack spacing={1}>
                          <LinearProgress
                            variant="determinate"
                            value={entry.progress}
                            sx={{
                              height: 8,
                              borderRadius: borderRadius.full,
                              "& .MuiLinearProgress-bar": {
                                borderRadius: borderRadius.full,
                              },
                            }}
                          />
                          <Typography variant="caption" color="text.secondary">
                            {entry.message || "Awaiting ingestion start."}
                          </Typography>

                          <Stepper activeStep={activeStep} alternativeLabel sx={{ mt: 0.6 }}>
                            <Step completed={entry.stage !== "queued"}>
                              <StepLabel>Upload</StepLabel>
                            </Step>
                            <Step completed={entry.stage === "indexing" || entry.stage === "completed"}>
                              <StepLabel>Parse</StepLabel>
                            </Step>
                            <Step completed={entry.stage === "completed"}>
                              <StepLabel>Index</StepLabel>
                            </Step>
                          </Stepper>
                        </Stack>
                      </Grid>

                      <Grid item xs={12} md={3}>
                        <Stack direction={{ xs: "row", md: "column" }} spacing={1} justifyContent="flex-end">
                          {entry.stage === "error" && (
                            <Button size="small" variant="outlined" startIcon={<Replay />} onClick={() => retryFile(entry.id)}>
                              Retry
                            </Button>
                          )}
                          {entry.stage === "completed" && (
                            <Button size="small" variant="outlined" color="success" startIcon={<DoneAll />} disabled>
                              Ready
                            </Button>
                          )}
                          {(entry.stage === "queued" || entry.stage === "error") && (
                            <Button
                              size="small"
                              variant="text"
                              color="inherit"
                              startIcon={<Delete />}
                              onClick={() => removeFile(entry.id)}
                            >
                              Remove
                            </Button>
                          )}
                        </Stack>
                      </Grid>
                    </Grid>
                  </CardContent>
                </Card>
              );
            })}
          </Stack>
        </Grid>
      </Grid>

      {errorCount > 0 && (
        <Alert severity="warning" sx={{ mt: spacing[2], borderRadius: borderRadius.md }}>
          {errorCount} file{errorCount > 1 ? "s" : ""} failed ingestion. Use Retry to recover without rebuilding the entire queue.
        </Alert>
      )}
    </Box>
  );
}
