import { ClinicalResponse } from '@/lib/types';

export const mockClinicalResponse: ClinicalResponse = {
  assessment: '65-year-old male with Type 2 Diabetes Mellitus (HbA1c 7.2%) and CKD Stage 3 (eGFR 42 mL/min/1.73m²). Current medications include Metformin 500mg BID, Lisinopril 10mg QD, and Empagliflozin 10mg QD. Patient has declining renal function requiring medication adjustment.',
  recommendation: 'Continue metformin at reduced dose of 500mg daily given eGFR 30-45. Discontinue if eGFR falls below 30 mL/min. SGLT2 inhibitors provide renal protection and reduce cardiovascular mortality. Monitor for signs of lactic acidosis.',
  evidence_summary: [
    'Current HbA1c is 7.2% indicating adequate but not optimal glycemic control',
    'Patient has Stage 3 CKD with eGFR 42 mL/min/1.73m², requiring dose adjustment',
    'SGLT2 inhibitors show 30% reduction in renal outcomes in CREDENCE trial',
    'Metformin should be dose-reduced when eGFR is 30-45 mL/min',
  ],
  drug_alerts: [
    {
      id: 'alert-1',
      severity: 'major',
      description: 'Metformin requires dose adjustment with eGFR 30-45 mL/min/1.73m². Discontinue if eGFR falls below 30.',
      source: 'DrugBank',
      evidence_level: 3,
      clinical_significance: 'Risk of lactic acidosis with advanced renal impairment',
      alternatives: ['Sitagliptin', 'Linagliptin'],
    },
    {
      id: 'alert-2',
      severity: 'moderate',
      description: 'Lisinopril may cause hyperkalemia when combined with empagliflozin. Monitor potassium levels.',
      source: 'FDA Label',
      evidence_level: 2,
      clinical_significance: 'Elevated potassium risk in CKD patients',
      alternatives: [],
    },
  ],
  citations: [
    {
      source_type: 'pubmed',
      identifier: '34921726',
      title: 'SGLT2 Inhibitors and Renal Outcomes in Type 2 Diabetes: Meta-analysis',
      relevance_score: 0.94,
      url: 'https://pubmed.ncbi.nlm.nih.gov/34921726/',
    },
    {
      source_type: 'pubmed',
      identifier: '35344086',
      title: 'ADA Standards of Medical Care in Diabetes - 2024',
      relevance_score: 0.91,
      url: 'https://pubmed.ncbi.nlm.nih.gov/35344086/',
    },
    {
      source_type: 'guideline',
      identifier: 'ADA_2024',
      title: 'Standards of Medical Care in Diabetes - 2024',
      relevance_score: 0.89,
      url: 'https://diabetesjournals.org/care',
    },
    {
      source_type: 'patient_record',
      identifier: 'lab_2024-01-15',
      title: 'Recent Lab Results - eGFR Trend',
      relevance_score: 0.95,
    },
  ],
  disclaimers: [
    'This system provides decision support only and is not a substitute for clinical judgment.',
    'All recommendations should be reviewed by a qualified healthcare professional.',
    'Drug dosing should be individualized based on patient-specific factors.',
  ],
  agent_outputs: {
    patient_history: {
      agent_name: 'Patient History Agent',
      latency_ms: 450,
      sources_retrieved: 3,
      summary: 'Retrieved patient profile with 3 active conditions, 3 medications, and 1 allergy.',
    },
    medical_literature: {
      agent_name: 'Medical Literature Agent',
      latency_ms: 1200,
      sources_retrieved: 8,
      summary: 'Found 15 relevant articles on SGLT2 inhibitors and diabetes management in CKD.',
    },
    protocol: {
      agent_name: 'Protocol Agent',
      latency_ms: 380,
      sources_retrieved: 2,
      summary: 'Retrieved ADA guidelines for diabetes and CKD management.',
    },
    drug_safety: {
      agent_name: 'Drug Safety Agent',
      latency_ms: 520,
      sources_retrieved: 4,
      summary: 'Identified 1 major and 1 moderate drug interaction requiring attention.',
    },
    guardrails: {
      agent_name: 'Guardrails Agent',
      latency_ms: 200,
      sources_retrieved: 5,
      summary: 'Validated all citations. No contraindications found. Confidence score assigned.',
    },
  },
  confidence_score: 0.87,
};
