import React from "react";
import { Box, BoxProps, Card, CardContent, CardProps, Stack, Typography } from "@mui/material";
import { borderRadius, componentShadows, spacing } from "@/theme";

export interface PageContainerProps extends BoxProps {
  children: React.ReactNode;
}

export function PageContainer({ children, ...props }: PageContainerProps) {
  return (
    <Box component="section" aria-label="Page content" {...props}>
      {children}
    </Box>
  );
}

export interface PageHeaderProps {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
}

export function PageHeader({ title, subtitle, actions }: PageHeaderProps) {
  return (
    <Stack
      direction={{ xs: "column", md: "row" }}
      spacing={1.5}
      justifyContent="space-between"
      alignItems={{ md: "center" }}
      sx={{ mb: spacing[4] }}
    >
      <Box>
        <Typography variant="h4" sx={{ mb: 0.5 }}>
          {title}
        </Typography>
        {subtitle && (
          <Typography variant="body2" color="text.secondary">
            {subtitle}
          </Typography>
        )}
      </Box>
      {actions ? <Box>{actions}</Box> : null}
    </Stack>
  );
}

export interface SectionCardProps extends Omit<CardProps, "children"> {
  children: React.ReactNode;
}

export function SectionCard({ children, sx, ...props }: SectionCardProps) {
  return (
    <Card
      sx={{
        borderRadius: borderRadius.md,
        boxShadow: componentShadows.card,
        ...sx,
      }}
      {...props}
    >
      <CardContent sx={{ p: spacing[3] }}>{children}</CardContent>
    </Card>
  );
}
