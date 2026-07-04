import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { QuizAttempt } from "../types";

export function useSession() {
  const [userId, setUserId] = useState<string | null>(null);
  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (mounted) setUserId(data.session?.user?.id ?? null);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setUserId(s?.user?.id ?? null);
    });
    return () => { mounted = false; sub.subscription.unsubscribe(); };
  }, []);
  return userId;
}

// ---------- Quiz ----------
export async function saveQuizAttempt(userId: string, a: Omit<QuizAttempt, "id" | "created_at">) {
  const { error } = await supabase.from("historia_quiz_attempts").insert({
    user_id: userId,
    quiz_id: a.quiz_id,
    score: a.score,
    total: a.total,
    duration_ms: a.duration_ms,
    answers: a.answers ?? [],
  });
  if (error) throw error;
}

export function useQuizAttempts(userId: string | null) {
  const [attempts, setAttempts] = useState<QuizAttempt[]>([]);
  const [loading, setLoading] = useState(false);
  const refresh = useCallback(async () => {
    if (!userId) { setAttempts([]); return; }
    setLoading(true);
    const { data } = await supabase
      .from("historia_quiz_attempts")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(200);
    setAttempts((data ?? []) as any);
    setLoading(false);
  }, [userId]);
  useEffect(() => { refresh(); }, [refresh]);
  return { attempts, loading, refresh };
}

// ---------- Plan progress ----------
export function usePlanProgress(userId: string | null, planId: string | null) {
  const [done, setDone] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);
  const refresh = useCallback(async () => {
    if (!userId || !planId) { setDone(new Set()); return; }
    setLoading(true);
    const { data } = await supabase
      .from("historia_plan_progress")
      .select("day_index")
      .eq("user_id", userId)
      .eq("plan_id", planId);
    setDone(new Set((data ?? []).map((r: any) => r.day_index)));
    setLoading(false);
  }, [userId, planId]);
  useEffect(() => { refresh(); }, [refresh]);

  const setCompleted = useCallback(async (dayIndex: number, completed: boolean) => {
    if (!userId || !planId) return;
    if (completed) {
      await supabase.from("historia_plan_progress").insert({ user_id: userId, plan_id: planId, day_index: dayIndex });
      setDone((s) => new Set(s).add(dayIndex));
    } else {
      await supabase.from("historia_plan_progress").delete().eq("user_id", userId).eq("plan_id", planId).eq("day_index", dayIndex);
      setDone((s) => { const n = new Set(s); n.delete(dayIndex); return n; });
    }
  }, [userId, planId]);

  return { done, setCompleted, loading, refresh };
}

export async function fetchAllPlanProgress(userId: string) {
  const { data } = await supabase
    .from("historia_plan_progress")
    .select("plan_id, day_index, completed_at")
    .eq("user_id", userId);
  return data ?? [];
}