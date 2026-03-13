import React, { useMemo, useState } from "react";
import {
  Alert,
  Avatar,
  Box,
  Card,
  CardContent,
  Chip,
  Divider,
  Grid,
  List,
  ListItemButton,
  ListItemText,
  Skeleton,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { Medication, Person, Science, WarningAmber } from "@mui/icons-material";
import { useNavigate, useParams } from "react-router-dom";
import LabResultsChart from "@/components/patient/LabResultsChart";
import MedicationList from "@/components/patient/MedicationList";
import { usePatient, usePatientSearch } from "@/hooks/usePatientData";
import type { LabResult, PatientProfile } from "@/lib/types";
import { alpha as alphaUtil, borderRadius, componentShadows, semantic, severity, spacing, transitions } from "@/theme";

function parseReferenceRange(reference?: string): { min?: number; max?: number } {
  if (!reference) return {};
  const match = reference.match(/(\d+\.?\d*)\s*[-–]\s*(\d+\.?\d*)/);
  if (!match) return {};
  return { min: Number(match[1]), max: Number(match[2]) };
}

function getLabState(lab: LabResult): "low" | "high" | "normal" | "unknown" {
  const { min, max } = parseReferenceRange(lab.reference_range);
  if (min === undefined || max === undefined) return "unknown";
  if (lab.value < min) return "low";
  if (lab.value > max) return "high";
  return "normal";
}

function stateColor(state: "low" | "high" | "normal" | "unknown"): string {
  if (state === "high" || state === "low") return semantic.warning.main;
  if (state === "normal") return semantic.success.main;
  return semantic.info.main;
}

export default function PatientPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [search, setSearch] = useState("P0");

  const { data: searchResults, isLoading: searchLoading } = usePatientSearch(search, 1, 50);
  const { data: selectedPatient, isLoading: patientLoading } = usePatient(id || "");

  const patients = ((searchResults as { patients?: PatientProfile[] } | undefined)?.patients ?? []).slice(0, 30);
  const patient = selectedPatient as PatientProfile | undefined;

  const latestLabs = useMemo(() => {
    if (!patient?.recent_labs?.length) return [] as LabResult[];
    const byCode = new Map<string, LabResult>();
    patient.recent_labs.forEach((lab) => {
      const existing = byCode.get(lab.code);
      if (!existing || new Date(lab.test_date).getTime() > new Date(existing.test_date).getTime()) {
        byCode.set(lab.code, lab);
      }
    });
    return Array.from(byCode.values()).slice(0, 8);
  }, [patient]);

  return (
    <Box>
      <Box sx={{ mb: spacing[4] }}>
        <Typography variant="h4" sx={{ mb: 0.5 }}>
          Patients Workspace
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Master-detail profile workflow with compact patient navigation and rich clinical context.
        </Typography>
      </Box>

      <Grid container spacing={2}>
        {/* Master list */}
        <Grid item xs={12} lg={4}>
          <Card sx={{ borderRadius: borderRadius.md, boxShadow: componentShadows.card, height: "100%" }}>
            <CardContent sx={{ p: spacing[3] }}>
              <TextField
                fullWidth
                size="small"
                label="Find Patient"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="ID or demographics..."
                sx={{ mb: 2 }}
              />

              {search.length < 2 ? (
                <Alert severity="info">Type at least 2 characters to search patients.</Alert>
              ) : searchLoading ? (
                <Stack spacing={1}>
                  {Array.from({ length: 8 }).map((_, index) => (
                    <Skeleton key={index} height={44} />
                  ))}
                </Stack>
              ) : patients.length === 0 ? (
                <Alert severity="warning">No patients matched your search.</Alert>
              ) : (
                <List dense disablePadding sx={{ maxHeight: "70vh", overflow: "auto" }}>
                  {patients.map((candidate) => {
                    const isActive = id === candidate.patient_id;
                    return (
                      <ListItemButton
                        key={candidate.patient_id}
                        selected={isActive}
                        onClick={() => navigate(`/patients/${candidate.patient_id}`)}
                        sx={{
                          mb: 0.6,
                          borderRadius: borderRadius.sm,
                          border: `1px solid ${isActive ? alphaUtil(semantic.info.main, 0.4) : "transparent"}`,
                          alignItems: "flex-start",
                        }}
                      >
                        <ListItemText
                          primary={
                            <Stack direction="row" spacing={1} alignItems="center">
                              <Typography variant="body2" sx={{ fontWeight: 700 }}>
                                {candidate.patient_id}
                              </Typography>
                              <Chip size="small" label={`${candidate.demographics.age}y`} />
                              <Chip size="small" label={candidate.demographics.sex} variant="outlined" />
                            </Stack>
                          }
                          secondary={
                            <Stack direction="row" spacing={0.8} sx={{ mt: 0.6 }}>
                              <Chip
                                size="small"
                                icon={<Science sx={{ fontSize: 13 }} />}
                                label={`${candidate.active_conditions.length} cond`}
                                sx={{ height: 22 }}
                              />
                              <Chip
                                size="small"
                                icon={<Medication sx={{ fontSize: 13 }} />}
                                label={`${candidate.active_medications.length} meds`}
                                sx={{ height: 22 }}
                              />
                              <Chip
                                size="small"
                                icon={<WarningAmber sx={{ fontSize: 13 }} />}
                                label={`${candidate.allergies.length} allergy`}
                                sx={{ height: 22 }}
                              />
                            </Stack>
                          }
                        />
                      </ListItemButton>
                    );
                  })}
                </List>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Detail profile */}
        <Grid item xs={12} lg={8}>
          {patientLoading ? (
            <Card sx={{ borderRadius: borderRadius.md }}>
              <CardContent>
                <Skeleton width="35%" height={36} />
                <Skeleton width="90%" height={24} />
                <Skeleton width="100%" height={180} />
              </CardContent>
            </Card>
          ) : !patient ? (
            <Card sx={{ borderRadius: borderRadius.md, boxShadow: componentShadows.card }}>
              <CardContent sx={{ py: spacing[8], textAlign: "center" }}>
                <Person sx={{ fontSize: 42, color: "text.disabled", mb: 1 }} />
                <Typography variant="h6">Select a patient</Typography>
                <Typography variant="body2" color="text.secondary">
                  Choose a patient from the left panel to open the detailed clinical profile.
                </Typography>
              </CardContent>
            </Card>
          ) : (
            <Stack spacing={2}>
              <Card sx={{ borderRadius: borderRadius.md, boxShadow: componentShadows.card }}>
                <CardContent sx={{ p: spacing[4] }}>
                  <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems={{ md: "center" }}>
                    <Avatar
                      sx={{
                        width: 64,
                        height: 64,
                        bgcolor: alphaUtil(semantic.info.main, 0.15),
                        color: semantic.info.main,
                        fontWeight: 700,
                      }}
                    >
                      {patient.patient_id.slice(-2)}
                    </Avatar>
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="h5" sx={{ mb: 0.4 }}>
                        Patient {patient.patient_id}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Last updated {new Date(patient.last_updated).toLocaleString()}
                      </Typography>
                    </Box>
                    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                      <Chip label={`${patient.demographics.age} years`} />
                      <Chip label={patient.demographics.sex} variant="outlined" />
                      <Chip label={`${patient.demographics.weight_kg} kg`} variant="outlined" />
                      <Chip label={`${patient.demographics.height_cm} cm`} variant="outlined" />
                    </Stack>
                  </Stack>

                  <Divider sx={{ my: 2 }} />

                  <Grid container spacing={2}>
                    <Grid item xs={12} md={6}>
                      <Typography variant="subtitle2" sx={{ mb: 1 }}>
                        Conditions
                      </Typography>
                      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                        {patient.active_conditions.length === 0 ? (
                          <Typography variant="body2" color="text.secondary">
                            No active conditions.
                          </Typography>
                        ) : (
                          patient.active_conditions.map((condition) => (
                            <TooltipChip
                              key={`${condition.code}-${condition.display}`}
                              label={condition.display}
                              tone="info"
                              tooltip={`${condition.coding_system}: ${condition.code}`}
                            />
                          ))
                        )}
                      </Stack>
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <Typography variant="subtitle2" sx={{ mb: 1 }}>
                        Allergies
                      </Typography>
                      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                        {patient.allergies.length === 0 ? (
                          <Typography variant="body2" color="text.secondary">
                            No known allergies.
                          </Typography>
                        ) : (
                          patient.allergies.map((allergy, index) => (
                            <TooltipChip
                              key={`${allergy.substance}-${index}`}
                              label={`${allergy.substance} (${allergy.severity})`}
                              tone={allergy.severity === "severe" ? "critical" : "warning"}
                              tooltip={allergy.reaction}
                            />
                          ))
                        )}
                      </Stack>
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>

              <MedicationList medications={patient.active_medications} title="Medication Profile" />

              <Card sx={{ borderRadius: borderRadius.md, boxShadow: componentShadows.card }}>
                <CardContent sx={{ p: spacing[4] }}>
                  <Typography variant="h6" sx={{ mb: 1.5 }}>
                    Lab Trend Signals
                  </Typography>
                  {latestLabs.length === 0 ? (
                    <Alert severity="info">No recent lab signals available.</Alert>
                  ) : (
                    <Grid container spacing={1.2} sx={{ mb: 2 }}>
                      {latestLabs.map((lab) => {
                        const state = getLabState(lab);
                        const tone = stateColor(state);
                        return (
                          <Grid item xs={12} sm={6} md={4} key={`${lab.code}-${lab.test_date}`}>
                            <Box
                              sx={{
                                p: 1.2,
                                borderRadius: borderRadius.sm,
                                border: `1px solid ${alphaUtil(tone, 0.3)}`,
                                bgcolor: alphaUtil(tone, 0.1),
                                transition: transitions.background.standard,
                              }}
                            >
                              <Typography variant="caption" color="text.secondary">
                                {lab.display}
                              </Typography>
                              <Typography variant="body2" sx={{ fontWeight: 700 }}>
                                {lab.value} {lab.unit}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                {state === "normal" ? "Within range" : state === "unknown" ? "No reference range" : `${state.toUpperCase()} signal`}
                              </Typography>
                            </Box>
                          </Grid>
                        );
                      })}
                    </Grid>
                  )}

                  <LabResultsChart labResults={patient.recent_labs} title="Lab Trends" />
                </CardContent>
              </Card>
            </Stack>
          )}
        </Grid>
      </Grid>
    </Box>
  );
}

function TooltipChip({ label, tone, tooltip }: { label: string; tone: "info" | "warning" | "critical"; tooltip: string }) {
  const toneColor =
    tone === "critical" ? severity.major.main : tone === "warning" ? severity.moderate.main : semantic.info.main;
  return (
    <Chip
      size="small"
      label={label}
      title={tooltip}
      sx={{
        bgcolor: alphaUtil(toneColor, 0.1),
        color: toneColor,
        border: `1px solid ${alphaUtil(toneColor, 0.3)}`,
      }}
    />
  );
}
