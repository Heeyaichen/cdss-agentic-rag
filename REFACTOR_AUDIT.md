# CDSS Frontend Refactor Audit

Generated: 2024-03-23

## Summary

The codebase uses Material UI (MUI) extensively across 39 files with 74 import occurrences. State management (Zustand) and data fetching (TanStack Query) are already aligned with the target architecture. Tailwind CSS is partially configured with some clinical tokens but needs consolidation.

---

## Analysis Results

### File Statistics
- **Total source files**: 68 TypeScript/TSX files
- **Total lines of code**: 14,566
- **Monolithic components (>200 lines)**: 34 files
- **MUI import occurrences**: 74 across 39 files
- **Hardcoded color values**: 322 occurrences across 20 files
- **Inline style usage**: 2 files (minimal)

### Current Stack
| Category | Current | Target | Status |
|----------|---------|--------|--------|
| UI Library | Material UI v5 | shadcn/ui | ❌ Replace |
| State | Zustand v4 | Zustand v4 | ✅ Aligned |
| Server State | TanStack Query v5 | TanStack Query v5 | ✅ Aligned |
| Styling | Tailwind CSS v3 + MUI | Tailwind CSS v3 | ⚠️ Consolidate |
| Routing | React Router v6 | React Router v6 | ✅ Aligned |
| Forms | React Hook Form | React Hook Form | ✅ Aligned |

### Route Structure
```
/                    → Dashboard (lazy)
/query               → QueryPage (lazy)
/patients            → PatientPage (lazy)
/patients/:id        → PatientPage (lazy)
/drugs               → DrugCheckerPage (lazy)
/literature          → LiteraturePage (lazy)
/documents           → DocumentUploadPage (lazy)
/admin               → AdminPage (lazy)
/settings            → SettingsPage (lazy)
```

---

## Components to Keep

Already clean, composable, < 200 lines, framework-agnostic:

| File | Lines | Notes |
|------|-------|-------|
| `src/stores/patientStore.ts` | 47 | Zustand store - well-structured |
| `src/stores/userStore.ts` | 88 | Zustand store - well-structured |
| `src/hooks/usePatientData.ts` | 41 | TanStack Query hook |
| `src/hooks/useStreamingQuery.ts` | 272 | Streaming logic - complex but necessary |
| `src/lib/auth.ts` | 82 | Auth utilities |
| `src/mocks/server.ts` | 4 | MSW server setup |
| `src/mocks/browser.ts` | 4 | MSW browser setup |
| `src/vite-env.d.ts` | 4 | Type definitions |

---

## Components to Refactor

Monolithic, MUI-dependent, or mixed concerns (>200 lines or requires migration):

| File | Lines | Issues |
|------|-------|--------|
| `src/pages/Dashboard.tsx` | 806 | MUI imports, monolithic |
| `src/pages/QueryPage.tsx` | 778 | MUI imports, inline styles |
| `src/theme/index.ts` | 667 | MUI theme - delete after migration |
| `src/theme/palette.ts` | 627 | 218 hardcoded colors - delete |
| `src/theme/designTokens.ts` | 487 | Replace with new token system |
| `src/pages/DocumentUploadPage.tsx` | 456 | MUI imports |
| `src/components/drugs/InteractionMatrix.tsx` | 432 | MUI imports, hardcoded colors |
| `src/pages/LiteraturePage.tsx` | 393 | MUI imports |
| `src/pages/AdminPage.tsx` | 392 | MUI imports |
| `src/components/ui/Input.tsx` | 375 | MUI-based, needs shadcn replacement |
| `src/components/ui/Chip.tsx` | 375 | MUI-based, needs shadcn replacement |
| `src/lib/api-client.ts` | 374 | Keep but update imports |
| `src/lib/types.ts` | 361 | Align with cdss.ts spec |
| `src/pages/DrugCheckerPage.tsx` | 357 | MUI imports |
| `src/theme/motion.ts` | 336 | Merge into design-tokens |
| `src/pages/PatientPage.tsx` | 330 | MUI imports |
| `src/components/layout/Sidebar.tsx` | 306 | MUI imports, hardcoded colors |
| `src/components/ui/Button.tsx` | 287 | MUI-based, needs shadcn replacement |
| `src/components/patient/MedicationList.tsx` | 280 | MUI imports |
| `src/mocks/handlers.ts` | 269 | Keep as-is |
| `src/theme/typography.ts` | 267 | Merge into design-tokens |
| `src/components/layout/Navbar.tsx` | 267 | MUI imports |
| `src/components/ui/Skeleton.tsx` | 260 | MUI-based, needs shadcn replacement |
| `src/mocks/data/patients.ts` | 253 | Mock data - keep |
| `src/components/clinical/DrugAlertBanner.tsx` | 243 | MUI imports, 5 hardcoded colors |
| `src/components/clinical/Citation.tsx` | 234 | MUI imports |
| `src/components/ui/Card.tsx` | 228 | MUI-based, needs shadcn replacement |
| `src/components/ui/Alert.tsx` | 222 | MUI-based, needs shadcn replacement |
| `src/components/clinical/EvidenceSummary.tsx` | 216 | MUI imports, hardcoded colors |
| `src/components/patient/LabResultsChart.tsx` | 212 | MUI imports, 6 hardcoded colors |
| `src/components/ui/Badge.tsx` | 211 | MUI-based, needs shadcn replacement |
| `src/components/clinical/AgentStatusCard.tsx` | 205 | MUI imports |
| `src/components/clinical/ResponseViewer.tsx` | 201 | MUI imports |
| `src/theme/shadows.ts` | 191 | Merge into design-tokens |
| `src/pages/SettingsPage.tsx` | 189 | MUI imports |
| `src/components/common/LoadingSkeleton.tsx` | 182 | MUI imports |
| `src/components/clinical/ConfidenceIndicator.tsx` | 159 | MUI imports |
| `src/theme/clinical.ts` | 150 | 45 hardcoded colors - merge |

---

## Components to Delete

Will be replaced by shadcn/ui or new architecture:

| File | Reason |
|------|--------|
| `src/components/ui/Button.tsx` | Replace with shadcn/ui Button |
| `src/components/ui/Card.tsx` | Replace with shadcn/ui Card |
| `src/components/ui/Alert.tsx` | Replace with shadcn/ui Alert |
| `src/components/ui/Badge.tsx` | Replace with shadcn/ui Badge |
| `src/components/ui/Chip.tsx` | Replace with shadcn/ui Badge |
| `src/components/ui/Input.tsx` | Replace with shadcn/ui Input |
| `src/components/ui/Skeleton.tsx` | Replace with shadcn/ui Skeleton |
| `src/components/ui/PagePrimitives.tsx` | Replace with shadcn/ui primitives |
| `src/theme/index.ts` | MUI theme - delete after migration |
| `src/theme/palette.ts` | MUI palette - delete after migration |
| `src/theme/clinical.ts` | Merge into new design-tokens.ts |
| `src/theme/motion.ts` | Merge into new design-tokens.ts |
| `src/theme/shadows.ts` | Merge into new design-tokens.ts |
| `src/theme/typography.ts` | Merge into new design-tokens.ts |

---

## Dependencies to Remove

After migration completes:

```json
{
  "@emotion/react": "^11.11.3",
  "@emotion/styled": "^11.11.0",
  "@mui/icons-material": "^5.15.10",
  "@mui/material": "^5.15.10",
  "@mui/x-data-grid": "^6.19.4",
  "@mui/x-date-pickers": "^6.19.4"
}
```

---

## Migration Risk Areas

### High Risk
1. **`src/pages/QueryPage.tsx`** (778 lines) - Complex streaming UI with multiple agent panels
2. **`src/pages/Dashboard.tsx`** (806 lines) - Multiple MUI components, routing logic
3. **`src/hooks/useStreamingQuery.ts`** (272 lines) - Critical streaming infrastructure
4. **`src/lib/api-client.ts`** (374 lines) - API client with streaming support
5. **`src/components/drugs/InteractionMatrix.tsx`** (432 lines) - Complex data visualization

### Medium Risk
1. **`src/components/clinical/ResponseViewer.tsx`** - Renders agent outputs
2. **`src/components/layout/AppShell.tsx`** - Main layout shell
3. **`src/components/layout/Sidebar.tsx`** - Navigation with MUI components
4. **`src/main.tsx`** - Root with MUI ThemeProvider

### Low Risk
1. **`src/stores/*.ts`** - Zustand stores are framework-agnostic
2. **`src/hooks/usePatientData.ts`** - Simple TanStack Query hook
3. **`src/mocks/data/*.ts`** - Mock data files have no UI dependencies

---

## Hardcoded Color Inventory

Files with the most hardcoded hex/rgb/hsl values:

| File | Count | Examples |
|------|-------|----------|
| `src/theme/palette.ts` | 218 | `#2e7d32`, `#c62828`, `#1976d2` |
| `src/theme/clinical.ts` | 45 | `#2e7d32`, `#f9a825`, `#c62828` |
| `src/theme/shadows.ts` | 19 | `rgba(0, 0, 0, 0.08)` |
| `src/theme/designTokens.ts` | 4 | Focus ring colors |
| `src/components/drugs/InteractionMatrix.tsx` | 5 | `#4caf50`, `#f44336` |
| `src/components/clinical/DrugAlertBanner.tsx` | 5 | `rgba(198, 40, 40, 0.24)` |
| `src/components/patient/LabResultsChart.tsx` | 6 | Chart colors |
| `src/components/ui/Badge.tsx` | 3 | `#000000`, alpha variants |
| `src/components/ui/Card.tsx` | 2 | `#DC2626`, `#000000` |

---

## Existing Tailwind Config Analysis

Current `tailwind.config.js` has:
- ✅ Clinical color tokens (partial - 4 values)
- ✅ Confidence colors (3 values)
- ✅ Severity colors (6 values)
- ✅ Evidence colors (5 values)
- ✅ Agent colors (4 values)
- ✅ Animation keyframes
- ⚠️ `preflight: false` (may cause conflicts)
- ❌ Missing: agent-specific colors matching spec, surface colors, text colors, border colors

---

## Execution Plan

1. ✅ **Step 1**: Create REFACTOR_AUDIT.md (this file)
2. **Step 2**: Create new design token system
3. **Step 3**: Initialize shadcn/ui and install components
4. **Step 4**: Create typed backend interfaces (cdss.ts)
5. **Step 5**: Establish target file structure
6. **Step 6**: Build AppShell layout
7. **Step 7**: Build core clinical components
8. **Step 8**: Build streaming infrastructure
9. **Step 9**: Build agent status indicator
10. **Step 10**: Wire up state management
11. **Step 11**: Remove legacy artifacts
12. **Step 12**: Create JSON→UI mapping example
