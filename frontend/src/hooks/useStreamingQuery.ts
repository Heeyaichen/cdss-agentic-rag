import { useState, useCallback, useRef, useEffect } from 'react';
import { ClinicalResponse, StreamingQueryUpdate } from '@/lib/types';
import { createStreamingConnection } from '@/lib/api-client';

interface UseStreamingQueryReturn {
  response: ClinicalResponse | null;
  isStreaming: boolean;
  progress: number;
  agentProgress: Record<string, number>;
  error: string | null;
  startStream: () => void;
  cancelStream: () => void;
  reset: () => void;
}

export function useStreamingQuery(
  query: string,
  patientId?: string,
  sessionId?: string
): UseStreamingQueryReturn {
  const [response, setResponse] = useState<ClinicalResponse | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [progress, setProgress] = useState(0);
  const [agentProgress, setAgentProgress] = useState<Record<string, number>>({});
  const [error, setError] = useState<string | null>(null);
  
  const cancelRef = useRef<(() => void) | null>(null);

  const startStream = useCallback(() => {
    setResponse(null);
    setProgress(0);
    setAgentProgress({});
    setError(null);
    setIsStreaming(true);

    cancelRef.current = createStreamingConnection(
      query,
      patientId,
      sessionId,
      (data) => {
        const update = data as StreamingQueryUpdate;
        
        if (update.type === 'agent_start') {
          setAgentProgress((prev) => ({
            ...prev,
            [update.agent || 'unknown']: 0,
          }));
        } else if (update.type === 'agent_progress') {
          setAgentProgress((prev) => ({
            ...prev,
            [update.agent || 'unknown']: update.progress || 0,
          }));
          setProgress(update.progress || 0);
        } else if (update.type === 'agent_complete') {
          setAgentProgress((prev) => ({
            ...prev,
            [update.agent || 'unknown']: 100,
          }));
        } else if (update.type === 'synthesis_complete') {
          if (update.response) {
            setResponse(update.response);
          }
          setProgress(100);
        } else if (update.type === 'error') {
          setError(update.message || 'An error occurred');
        }
      },
      (err) => {
        setError(err.message);
        setIsStreaming(false);
      },
      () => {
        setIsStreaming(false);
      }
    );
  }, [query, patientId, sessionId]);

  const cancelStream = useCallback(() => {
    if (cancelRef.current) {
      cancelRef.current();
      cancelRef.current = null;
    }
    setIsStreaming(false);
  }, []);

  const reset = useCallback(() => {
    setResponse(null);
    setProgress(0);
    setAgentProgress({});
    setError(null);
    setIsStreaming(false);
    if (cancelRef.current) {
      cancelRef.current();
      cancelRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      if (cancelRef.current) {
        cancelRef.current();
      }
    };
  }, []);

  return {
    response,
    isStreaming,
    progress,
    agentProgress,
    error,
    startStream,
    cancelStream,
    reset,
  };
}
