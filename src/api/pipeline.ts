import { apiGet } from "@/api/client";
import type {
  AccountResponse,
  DecisionsResponse,
  HealthResponse,
  MaturityResponse,
  OverviewResponse,
  SignalsResponse,
} from "@/api/types";

export const healthPath = () => "/api/v1/health";
export const overviewPath = () => "/api/v1/overview";
export const maturityPath = () => "/api/v1/maturity";
export const signalsPath = () => "/api/v1/signals";
export const accountPath = () => "/api/v1/account";
export const decisionsPath = () => "/api/v1/decisions";

export const fetchHealth = (signal?: AbortSignal) =>
  apiGet<HealthResponse>(healthPath(), { signal });
export const fetchOverview = (signal?: AbortSignal) =>
  apiGet<OverviewResponse>(overviewPath(), { signal });
export const fetchMaturity = (signal?: AbortSignal) =>
  apiGet<MaturityResponse>(maturityPath(), { signal });
export const fetchSignals = (signal?: AbortSignal) =>
  apiGet<SignalsResponse>(signalsPath(), { signal });
export const fetchAccount = (signal?: AbortSignal) =>
  apiGet<AccountResponse>(accountPath(), { signal });
export const fetchDecisions = (signal?: AbortSignal) =>
  apiGet<DecisionsResponse>(decisionsPath(), { signal });
