// ──────────────────────────────────────────────────────────────────────────────
// Quioba — usePredictiveShopping (Fase 4.4)
// Analiza el historial de shopping_items para detectar patrones recurrentes.
// 100% local — sin API externa.
// ──────────────────────────────────────────────────────────────────────────────

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { subWeeks, format } from 'date-fns';

export type ConfidenceLevel = 'low' | 'medium' | 'high';

export interface PredictiveItem {
  name: string;           // nombre normalizado
  frequency: number;      // veces que aparece en el historial
  lastSeen: string;       // ISO date de la última vez
  confidence: ConfidenceLevel;
}

export interface UsePredictiveShoppingResult {
  suggestions: PredictiveItem[];
  confidenceLevel: ConfidenceLevel;  // nivel global según antigüedad de datos
  dataWeeks: number;                 // semanas de historial disponibles
  loading: boolean;
}

/**
 * Normaliza un nombre de item para compararlo correctamente.
 * Quita tildes, pasa a minúsculas y recorta espacios.
 */
function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

export function usePredictiveShopping(
  userId: string | null | undefined,
  currentItems: string[] = []  // items ya en la lista (para no sugerirlos)
): UsePredictiveShoppingResult {
  const [suggestions, setSuggestions] = useState<PredictiveItem[]>([]);
  const [confidenceLevel, setConfidenceLevel] = useState<ConfidenceLevel>('low');
  const [dataWeeks, setDataWeeks] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) { setLoading(false); return; }
    analyze();
  }, [userId]);

  const analyze = async () => {
    try {
      // Cargar historial de las últimas 8 semanas (is_checked = true = comprados)
      const since8w = subWeeks(new Date(), 8).toISOString();
      const { data: items } = await supabase
        .from('shopping_items')
        .select('name, created_at, is_checked')
        .eq('user_id', userId!)
        .gte('created_at', since8w)
        .order('created_at', { ascending: false });

      if (!items || items.length === 0) {
        setLoading(false);
        return;
      }

      // Calcular antigüedad real de los datos en semanas
      const oldestDate = new Date(items[items.length - 1].created_at);
      const nowDate = new Date();
      const diffMs = nowDate.getTime() - oldestDate.getTime();
      const weeks = Math.floor(diffMs / (1000 * 60 * 60 * 24 * 7));
      setDataWeeks(weeks);

      // Nivel de confianza global
      let globalConfidence: ConfidenceLevel = 'low';
      if (weeks >= 8) globalConfidence = 'high';
      else if (weeks >= 4) globalConfidence = 'medium';
      setConfidenceLevel(globalConfidence);

      // Agrupar por nombre normalizado y contar frecuencia
      const frequencyMap = new Map<string, { count: number; original: string; lastSeen: string }>();
      for (const item of items) {
        const key = normalizeName(item.name);
        const existing = frequencyMap.get(key);
        if (!existing) {
          frequencyMap.set(key, { count: 1, original: item.name, lastSeen: item.created_at });
        } else {
          frequencyMap.set(key, {
            count: existing.count + 1,
            original: existing.original,
            lastSeen: existing.lastSeen < item.created_at ? item.created_at : existing.lastSeen,
          });
        }
      }

      // Normalizar los items actuales de la lista para no sugerirlos
      const currentNormalized = new Set(currentItems.map(normalizeName));

      // Filtrar: solo los que aparecen >= 2 veces y no están ya en la lista
      const predictive: PredictiveItem[] = [];
      frequencyMap.forEach((val, key) => {
        if (val.count < 2) return;
        if (currentNormalized.has(key)) return;

        let itemConfidence: ConfidenceLevel = 'low';
        if (val.count >= 4) itemConfidence = 'high';
        else if (val.count >= 3) itemConfidence = 'medium';

        predictive.push({
          name: val.original,
          frequency: val.count,
          lastSeen: val.lastSeen,
          confidence: itemConfidence,
        });
      });

      // Ordenar por frecuencia descendente
      predictive.sort((a, b) => b.frequency - a.frequency);

      setSuggestions(predictive.slice(0, 8)); // máximo 8 sugerencias
    } catch (e) {
      console.error('usePredictiveShopping error:', e);
    } finally {
      setLoading(false);
    }
  };

  return { suggestions, confidenceLevel, dataWeeks, loading };
}
