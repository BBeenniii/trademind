import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './api';

export function useMarketData() {
  return useQuery({ queryKey: ['market-data'], queryFn: api.marketData });
}

export function useLatestSignal() {
  return useQuery({ queryKey: ['signals', 'latest'], queryFn: api.latestSignal });
}

export function useSignals() {
  return useQuery({ queryKey: ['signals'], queryFn: api.signals });
}

export function useGenerateSignal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.generateSignal,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['signals'] });
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
      queryClient.invalidateQueries({ queryKey: ['ai-summary'] });
    }
  });
}

export function useLatestBacktest() {
  return useQuery({ queryKey: ['backtests', 'latest'], queryFn: api.latestBacktest });
}

export function useRunBacktest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.runBacktest,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backtests'] });
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
      queryClient.invalidateQueries({ queryKey: ['ai-summary'] });
    }
  });
}

export function useAiSummary() {
  return useQuery({ queryKey: ['ai-summary'], queryFn: api.aiSummary });
}

export function useGenerateSummary() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.generateSummary,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['ai-summary'] })
  });
}

export function useAlerts() {
  return useQuery({ queryKey: ['alerts'], queryFn: api.alerts });
}

export function useTestAlert() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.testAlert,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['alerts'] })
  });
}

export function useLiveState() {
  return useQuery({ queryKey: ['live-state'], queryFn: api.liveState, refetchInterval: 10_000 });
}

export function useSwitchLiveProvider() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.switchLiveProvider,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['live-state'] })
  });
}

export function useResetPaper() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.resetPaper,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['live-state'] })
  });
}

export function useModels() {
  return useQuery({ queryKey: ['models'], queryFn: api.models });
}

export function useChampionModel() {
  return useQuery({ queryKey: ['models', 'champion'], queryFn: api.championModel });
}

export function useModelPerformance() {
  return useQuery({ queryKey: ['models', 'performance'], queryFn: api.modelPerformance });
}

export function useLearningSummary() {
  return useQuery({ queryKey: ['models', 'summary'], queryFn: api.learningSummary });
}

export function useModelFeedback() {
  return useQuery({ queryKey: ['models', 'feedback'], queryFn: api.modelFeedback });
}

export function useModelTrainingRuns() {
  return useQuery({ queryKey: ['models', 'training-runs'], queryFn: api.modelTrainingRuns });
}

export function useRetrainModel() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.retrainModel,
    onSuccess: () => invalidateModelQueries(queryClient)
  });
}

export function usePromoteModel() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.promoteModel,
    onSuccess: () => invalidateModelQueries(queryClient)
  });
}

export function useDatasetStatus() {
  return useQuery({ queryKey: ['dataset', 'status'], queryFn: api.datasetStatus });
}

export function useProcessDataset() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.processDataset,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['dataset'] })
  });
}

export function useTrainAdvancedModel() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.trainAdvancedModel,
    onSuccess: () => invalidateModelQueries(queryClient)
  });
}

export function useCompareModels() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.compareModels,
    onSuccess: () => invalidateModelQueries(queryClient)
  });
}

export function useFeatureImportance(id?: number) {
  return useQuery({
    queryKey: ['models', id, 'feature-importance'],
    queryFn: () => api.featureImportance(id!),
    enabled: Boolean(id)
  });
}

export function useOnlineStatus() {
  return useQuery({ queryKey: ['models', 'online', 'status'], queryFn: api.onlineStatus });
}

export function useUpdateOnlineLearner() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.updateOnlineLearner,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['models', 'online'] })
  });
}

function invalidateModelQueries(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: ['models'] });
  queryClient.invalidateQueries({ queryKey: ['live-state'] });
  queryClient.invalidateQueries({ queryKey: ['alerts'] });
}