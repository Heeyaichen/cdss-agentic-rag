import axios, { AxiosError, AxiosInstance, AxiosRequestConfig } from 'axios';
import { msalInstance } from './auth';
import { ApiError, DocumentIngestResponse, DocumentIngestionStatusResponse, PatientProfile } from './types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';
const API_SCOPE = import.meta.env.VITE_API_SCOPE || '';

class ApiClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.client.interceptors.request.use(async (config) => {
      try {
        const account = msalInstance.getAllAccounts()[0];
        if (account) {
          const response = await msalInstance.acquireTokenSilent({
            scopes: [API_SCOPE],
            account,
          });
          config.headers.Authorization = `Bearer ${response.accessToken}`;
        }
      } catch (error) {
        console.error('Failed to acquire token:', error);
      }
      return config;
    });

    this.client.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => {
        const responseData = error.response?.data as { message?: string } | undefined;
        const apiError: ApiError = {
          message: responseData?.message || error.message,
          status_code: error.response?.status,
          details: error.response?.data,
        };
        return Promise.reject(apiError);
      }
    );
  }

  async get<T = any>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.get<T>(url, config);
    return response.data;
  }

  async post<T = any>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.post<T>(url, data, config);
    return response.data;
  }

  async put<T = any>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.put<T>(url, data, config);
    return response.data;
  }

  async delete<T = any>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.delete<T>(url, config);
    return response.data;
  }
}

export const apiClient = new ApiClient();

export const clinicalApi = {
  submitQuery: async (query: string, patientId?: string, sessionId?: string) => {
    return apiClient.post('/v1/query', {
      text: query,
      patient_id: patientId,
      session_id: sessionId,
    });
  },

  getQuery: async (queryId: string) => {
    return apiClient.get(`/v1/query/${queryId}`);
  },

  getPatient: async (patientId: string) => {
    return apiClient.get<PatientProfile>(`/v1/patients/${patientId}`);
  },

  searchPatients: async (params: { search?: string; page?: number; limit?: number }) => {
    return apiClient.get('/v1/patients', { params });
  },

  checkDrugInteractions: async (medications: Array<{ name: string; rxcui?: string }>, patientId?: string) => {
    return apiClient.post('/v1/drugs/interactions', {
      medications,
      patient_id: patientId,
    });
  },

  searchLiterature: async (params: {
    query: string;
    max_results?: number;
    date_range?: { start: string; end: string };
    article_types?: string[];
  }) => {
    return apiClient.post('/v1/search/literature', params);
  },

  searchProtocols: async (params: { query: string; specialty?: string; max_results?: number }) => {
    return apiClient.post('/v1/search/protocols', params);
  },

  ingestDocument: async (
    file: File,
    documentType: string,
    metadata?: Record<string, unknown>
  ): Promise<DocumentIngestResponse> => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('document_type', documentType);
    if (metadata) {
      formData.append('metadata', JSON.stringify(metadata));
    }
    return apiClient.post<DocumentIngestResponse>('/v1/documents/ingest', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  getDocumentIngestionStatus: async (documentId: string): Promise<DocumentIngestionStatusResponse> => {
    return apiClient.get<DocumentIngestionStatusResponse>(`/v1/documents/${documentId}/status`);
  },

  getAuditTrail: async (params: {
    start_date?: string;
    end_date?: string;
    event_type?: string;
    actor_id?: string;
    page?: number;
    limit?: number;
  }) => {
    return apiClient.get('/v1/audit', { params });
  },

  getHealthCheck: async () => {
    return apiClient.get('/v1/health');
  },
};

export function createStreamingConnection(
  query: string,
  onMessage: (data: unknown) => void,
  onError: (error: Error) => void,
  onComplete: () => void,
  patientId?: string,
  sessionId?: string
): () => void {
  const params = new URLSearchParams({
    query,
    ...(patientId && { patient_id: patientId }),
    ...(sessionId && { session_id: sessionId }),
  });

  const eventSource = new EventSource(`${API_BASE_URL}/v1/query/stream?${params}`);

  eventSource.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      onMessage(data);
    } catch {
      onMessage(event.data);
    }
  };

  eventSource.onerror = (event) => {
    onError(new Error(event instanceof ErrorEvent ? event.message : 'Connection error'));
    eventSource.close();
    onComplete();
  };

  return () => {
    eventSource.close();
    onComplete();
  };
}
