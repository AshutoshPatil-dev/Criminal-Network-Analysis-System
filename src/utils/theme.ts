import type { EntityType } from '../types';

export const entityTypeColors: Record<EntityType, string> = {
  person: '#0B3D91',
  phone: '#7C3AED',
  vehicle: '#DC2626',
  location: '#16A34A',
  org: '#F59E0B',
};

export const entityTypeIcons: Record<EntityType, string> = {
  person: '\u25CF',
  phone: '\u260E',
  vehicle: '\u2697',
  location: '\u2302',
  org: '\u2605',
};

export const riskColor = (score: number) => {
  if (score >= 70) return '#DC2626';
  if (score >= 40) return '#F59E0B';
  return '#16A34A';
};

export const riskLabelKey = (score: number) => {
  if (score >= 70) return 'highRisk' as const;
  if (score >= 40) return 'mediumRisk' as const;
  return 'lowRisk' as const;
};