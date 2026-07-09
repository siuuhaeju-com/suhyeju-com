'use client';

import { useEffect, useState } from 'react';

import type { RecentAnalysis } from '@/lib/types';

const LOCAL_ANALYSES_KEY = 'suhyeju:my-analyses:v1';
const LOCAL_ANALYSES_MAX = 5;
const LOCAL_ANALYSES_CHANGED_EVENT = 'suhyeju:my-analyses:changed';

export type LocalAnalysis = RecentAnalysis & {
  /** 이 브라우저에서 마지막으로 열어본 시각. 내 최근 목록 정렬 기준이다. */
  lastOpenedAt?: string;
};

type LocalAnalysesState = {
  items: LocalAnalysis[];
  isLoaded: boolean;
};

export function normalizeLocalOriginUrl(url: string): string | null {
  const trimmed = url.trim();
  if (!trimmed) return null;

  try {
    const normalized = new URL(trimmed);
    normalized.hash = '';
    return normalized.toString();
  } catch {
    return trimmed;
  }
}

function canUseLocalStorage() {
  return typeof window !== 'undefined' && 'localStorage' in window;
}

function isLocalAnalysis(value: unknown): value is LocalAnalysis {
  if (!value || typeof value !== 'object') return false;

  const item = value as Partial<Record<keyof LocalAnalysis, unknown>>;
  return (
    typeof item.id === 'string' &&
    typeof item.title === 'string' &&
    typeof item.analyzedAt === 'string' &&
    typeof item.originUrl === 'string' &&
    (item.lastOpenedAt === undefined || typeof item.lastOpenedAt === 'string')
  );
}

function getLocalAnalysisTime(item: LocalAnalysis): number {
  const time = Date.parse(item.lastOpenedAt ?? item.analyzedAt);
  return Number.isNaN(time) ? 0 : time;
}

function sortLocalAnalysesByLatestOpen(items: LocalAnalysis[]): LocalAnalysis[] {
  return [...items].sort((a, b) => getLocalAnalysisTime(b) - getLocalAnalysisTime(a));
}

function readLocalAnalyses(): LocalAnalysis[] {
  if (!canUseLocalStorage()) return [];

  try {
    const raw = window.localStorage.getItem(LOCAL_ANALYSES_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];

    return sortLocalAnalysesByLatestOpen(parsed.filter(isLocalAnalysis)).slice(
      0,
      LOCAL_ANALYSES_MAX,
    );
  } catch {
    return [];
  }
}

function writeLocalAnalyses(items: LocalAnalysis[]) {
  if (!canUseLocalStorage()) return;

  try {
    window.localStorage.setItem(LOCAL_ANALYSES_KEY, JSON.stringify(items));
    window.dispatchEvent(new Event(LOCAL_ANALYSES_CHANGED_EVENT));
  } catch {
    // localStorage가 차단되거나 용량 제한에 걸려도 분석 흐름은 계속 진행한다.
  }
}

export function getLocalAnalyses(): LocalAnalysis[] {
  return readLocalAnalyses();
}

export function getLocalAnalysisById(id: string): LocalAnalysis | null {
  return readLocalAnalyses().find((item) => item.id === id) ?? null;
}

export function saveLocalAnalysis(item: LocalAnalysis) {
  const originUrl = normalizeLocalOriginUrl(item.originUrl);
  if (!originUrl) return;

  const current = readLocalAnalyses();
  const nextItem = { ...item, originUrl, lastOpenedAt: new Date().toISOString() };
  const next = sortLocalAnalysesByLatestOpen([
    nextItem,
    ...current.filter((saved) => {
      const savedOriginUrl = normalizeLocalOriginUrl(saved.originUrl);
      return saved.id !== item.id && savedOriginUrl !== originUrl;
    }),
  ]).slice(0, LOCAL_ANALYSES_MAX);

  writeLocalAnalyses(next);
}

export function touchLocalAnalysis(id: string) {
  const current = readLocalAnalyses();
  const next = sortLocalAnalysesByLatestOpen(
    current.map((item) =>
      item.id === id ? { ...item, lastOpenedAt: new Date().toISOString() } : item,
    ),
  ).slice(0, LOCAL_ANALYSES_MAX);

  writeLocalAnalyses(next);
}

export function useLocalAnalyses(): LocalAnalysesState {
  const [state, setState] = useState<LocalAnalysesState>({ items: [], isLoaded: false });

  useEffect(() => {
    const refresh = () => {
      setState({ items: readLocalAnalyses(), isLoaded: true });
    };
    const handleStorage = (event: StorageEvent) => {
      if (event.key === LOCAL_ANALYSES_KEY) {
        refresh();
      }
    };
    const handleLocalChange = () => refresh();

    refresh();
    window.addEventListener('storage', handleStorage);
    window.addEventListener(LOCAL_ANALYSES_CHANGED_EVENT, handleLocalChange);

    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener(LOCAL_ANALYSES_CHANGED_EVENT, handleLocalChange);
    };
  }, []);

  return state;
}
