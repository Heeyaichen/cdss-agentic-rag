import { http, HttpResponse, delay } from 'msw';
import { mockPatients } from './data/patients';
import { mockClinicalResponse } from './data/clinical';
import { mockArticles } from './data/literature';
import { mockAuditLog, mockDashboardStats } from './data/audit';

const API_BASE = '/api/v1';

export const handlers = [
  // Health check
  http.get(`${API_BASE}/health`, () => {
    return HttpResponse.json({
      status: 'healthy',
      version: '1.0.0',
      services: {
        openai: 'healthy',
        cosmos: 'healthy',
        redis: 'healthy',
        search: 'healthy',
      },
      timestamp: new Date().toISOString(),
    });
  }),

  // Patient endpoints
  http.get(`${API_BASE}/patients/:id`, async ({ params }) => {
    await delay(300);
    const patient = mockPatients.find(p => p.patient_id === params.id);
    if (!patient) {
      return new HttpResponse(null, { status: 404 });
    }
    return HttpResponse.json(patient);
  }),

  http.get(`${API_BASE}/patients`, async ({ request }) => {
    await delay(400);
    const url = new URL(request.url);
    const search = url.searchParams.get('search') || '';
    
    let filtered = mockPatients;
    if (search) {
      filtered = mockPatients.filter(p => 
        p.patient_id.toLowerCase().includes(search.toLowerCase()) ||
        p.demographics.sex.toLowerCase().includes(search.toLowerCase())
      );
    }
    
    return HttpResponse.json({
      patients: filtered,
      total: filtered.length,
      page: 1,
      page_size: 20,
    });
  }),

  // Clinical query endpoints
  http.post(`${API_BASE}/query`, async () => {
    await delay(1500);
    return HttpResponse.json({
      query_id: 'query_' + Date.now(),
      status: 'completed',
      clinical_response: mockClinicalResponse,
    });
  }),

  http.get(`${API_BASE}/query/stream`, async () => {
    // SSE streaming is handled separately - return mock response for now
    await delay(2000);
    return HttpResponse.json({
      query_id: 'stream_query_' + Date.now(),
      status: 'completed',
      clinical_response: mockClinicalResponse,
    });
  }),

  // Drug interaction check
  http.post(`${API_BASE}/drugs/interactions`, async ({ request }) => {
    await delay(800);
    const body = await request.json();
    const medications = (body as unknown as { medications?: { name: string; rxnorm_cui?: string; dose: string; frequency: string }[] }).medications ?? [];
    
    const interactions = [];
    for (let i = 0; i < medications.length; i++) {
      for (let j = i + 1; j < medications.length; j++) {
        if (Math.random() > 0.5) {
          interactions.push({
            drug_a: medications[i].name,
            drug_b: medications[j].name,
            severity: ['minor', 'moderate', 'major'][Math.floor(Math.random() * 3)],
            description: `Potential interaction between ${medications[i].name} and ${medications[j].name}. Monitor patient closely.`,
            evidence_level: Math.floor(Math.random() * 3) + 1,
            source: 'DrugBank 2024',
          });
        }
      }
    }
    
    return HttpResponse.json({
      interactions,
      alternatives: [],
      dosage_adjustments: [],
    });
  }),

  // Literature search
  http.post(`${API_BASE}/search/literature`, async ({ request }) => {
    await delay(1200);
    const body = await request.json();
    const maxResults = (body as any)?.max_results || 10;
    
    return HttpResponse.json({
      papers: mockArticles.slice(0, maxResults),
      total: mockArticles.length,
      page: 1,
      page_size: maxResults,
    });
  }),

  // Protocol search
  http.post(`${API_BASE}/search/protocols`, async ({ request }) => {
    await delay(600);
    const body = await request.json();
    
    return HttpResponse.json({
      protocols: [
        {
          guideline_name: 'ADA Standards of Medical Care in Diabetes - 2024',
          version: '2024.1',
          recommendation: 'For patients with T2DM and CKD, consider SGLT2 inhibitors for renal protection.',
          evidence_grade: 'A',
          specialty: 'Endocrinology',
          contraindications: ['eGFR < 30 mL/min for some SGLT2i'],
          last_updated: '2024-01-01',
        },
      ],
      total: 1,
      page: 1,
      page_size: 10,
    });
  }),

  // Document ingestion
  http.post(`${API_BASE}/documents/ingest`, async () => {
    await delay(1000);
    return HttpResponse.json({
      document_id: 'doc_' + Date.now(),
      status: 'processing',
      message: 'Document accepted for ingestion. Processing started.',
      estimated_completion_seconds: 45,
      chunks_count: Math.floor(Math.random() * 20) + 5,
    });
  }),

  // Audit trail
  http.get(`${API_BASE}/audit`, async ({ request }) => {
    await delay(500);
    const url = new URL(request.url);
    const eventType = url.searchParams.get('event_type');
    
    let filtered = mockAuditLog;
    if (eventType) {
      filtered = mockAuditLog.filter(e => e.event_type.includes(eventType));
    }
    
    return HttpResponse.json(filtered);
  }),
];
