import Constants from 'expo-constants';

import type {
  CandlePayload,
  MarketsPayload,
  PlansPayload,
  Pricing,
  SignalBoard,
  TrackRecord,
} from './types';

const extra = Constants.expoConfig?.extra as { apiBase?: string } | undefined;

export const API_BASE = (
  process.env.EXPO_PUBLIC_API_BASE ||
  extra?.apiBase ||
  'https://aurafxelite.com'
).replace(/\/$/, '');

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

function messageFrom(body: unknown): string | null {
  if (!body || typeof body !== 'object') return null;
  const record = body as Record<string, unknown>;
  if (typeof record.error === 'string' && record.error.trim()) return record.error.trim();
  if (typeof record.note === 'string' && record.note.trim()) return record.note.trim();
  return null;
}

export async function apiGet<T>(path: string): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 25000);
  try {
    const response = await fetch(`${API_BASE}${path}`, {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    const text = await response.text();
    let body: unknown = null;
    if (text) {
      try {
        body = JSON.parse(text) as unknown;
      } catch {
        body = null;
      }
    }
    if (!response.ok) {
      throw new ApiError(
        messageFrom(body) || `The server returned ${response.status} for ${path}.`,
        response.status,
      );
    }
    if (!body || typeof body !== 'object') {
      throw new ApiError(`The response from ${path} was not JSON.`, response.status);
    }
    return body as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (error instanceof Error && error.name === 'AbortError') {
      throw new ApiError(`The request to ${path} timed out.`, 0);
    }
    throw new ApiError(
      error instanceof Error ? error.message : `Could not reach ${path}.`,
      0,
    );
  } finally {
    clearTimeout(timer);
  }
}

export function getSignalBoard(): Promise<SignalBoard> {
  return apiGet<SignalBoard>('/api/signals');
}

export function getTrackRecord(instrument?: string): Promise<TrackRecord> {
  const query = instrument ? `?instrument=${encodeURIComponent(instrument)}` : '';
  return apiGet<TrackRecord>(`/api/signals/track-record${query}`);
}

export function getMarkets(): Promise<MarketsPayload> {
  return apiGet<MarketsPayload>('/api/markets');
}

export function getPricing(): Promise<Pricing> {
  return apiGet<Pricing>('/api/pricing');
}

export function getPlans(): Promise<PlansPayload> {
  return apiGet<PlansPayload>('/api/signals/plans');
}

export function getCandles(instrument: string): Promise<CandlePayload> {
  const params = new URLSearchParams({ instrument, timeframe: 'H1' });
  return apiGet<CandlePayload>(`/api/members/candles?${params.toString()}`);
}
