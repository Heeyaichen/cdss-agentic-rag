import { DrugInteraction } from '@/lib/types';

export const mockDrugInteractions: DrugInteraction[] = [
  {
    drug_a: 'Metformin',
    drug_b: 'Cimetidine',
    severity: 'moderate',
    description: 'Cimetidine may increase the serum concentration of Metformin, increasing the risk of lactic acidosis.',
    evidence_level: 2,
    source: 'DrugBank',
    clinical_significance: 'Monitor for signs of lactic acidosis; consider alternative H2 blocker.',
  },
  {
    drug_a: 'Lisinopril',
    drug_b: 'Potassium',
    severity: 'major',
    description: 'ACE inhibitors may increase serum potassium levels, leading to hyperkalemia.',
    evidence_level: 3,
    source: 'FDA',
    clinical_significance: 'Monitor potassium levels closely; avoid potassium supplements.',
  },
  {
    drug_a: 'Metformin',
    drug_b: 'Alcohol',
    severity: 'major',
    description: 'Alcohol potentiates the effect of metformin on lactate metabolism, increasing the risk of lactic acidosis.',
    evidence_level: 2,
    source: 'DrugBank',
    clinical_significance: 'Avoid excessive alcohol consumption while taking metformin.',
  },
  {
    drug_a: 'Aspirin',
    drug_b: 'Metoprolol',
    severity: 'minor',
    description: 'Aspirin may diminish the therapeutic effect of Metoprolol.',
    evidence_level: 1,
    source: 'Lexicomp',
    clinical_significance: 'Monitor blood pressure; adjustment may be needed.',
  },
  {
    drug_a: 'Atorvastatin',
    drug_b: 'Clarithromycin',
    severity: 'major',
    description: 'Strong CYP3A4 inhibitors like clarithromycin significantly increase atorvastatin exposure, increasing risk of myopathy.',
    evidence_level: 3,
    source: 'FDA',
    clinical_significance: 'Avoid concomitant use; consider temporary atorvastatin discontinuation.',
  },
];

export const mockInteractionsResponse = {
  interactions: mockDrugInteractions,
  alternatives: ['Sitagliptin', 'Linagliptin', 'Amlodipine'],
  dosage_adjustments: [
    'Reduce metformin to 500mg daily if eGFR 30-45',
    'Discontinue metformin if eGFR <30',
    'Monitor potassium levels with ACE inhibitors',
  ],
};
