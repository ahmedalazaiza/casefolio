"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type QuestMissionId =
  | "device-swap"
  | "token-style"
  | "slot-fill"
  | "workflow-step"
  | "publish-launch";

export interface QuestMissionDefinition {
  id: QuestMissionId;
  shortLabel: string;
  title: string;
  xp: number;
  targetAnchor: string;
}

export const STUDIO_QUEST_MISSIONS: readonly QuestMissionDefinition[] = [
  {
    id: "device-swap",
    shortLabel: "Swap device",
    title: "Switch template or device frame in the live editor",
    xp: 20,
    targetAnchor: "#hero-playground",
  },
  {
    id: "token-style",
    shortLabel: "Tune tokens",
    title: "Apply a curated color token palette",
    xp: 20,
    targetAnchor: "#hero-playground",
  },
  {
    id: "slot-fill",
    shortLabel: "Snap slot",
    title: "Fill the empty screenshot slot to pass pre-publish check",
    xp: 20,
    targetAnchor: "#hero-playground",
  },
  {
    id: "workflow-step",
    shortLabel: "Explore steps",
    title: "Inspect a stage in the 4-step workflow",
    xp: 20,
    targetAnchor: "#how-it-works",
  },
  {
    id: "publish-launch",
    shortLabel: "Test publish",
    title: "Simulate launching a live casefolio.app URL",
    xp: 20,
    targetAnchor: "#publish-export",
  },
] as const;

export const MAX_QUEST_XP = STUDIO_QUEST_MISSIONS.reduce(
  (sum, item) => sum + item.xp,
  0,
);

export function resolveQuestRank(xp: number): {
  level: number;
  title: string;
} {
  if (xp >= 100) return { level: 5, title: "Ship-Ready Designer" };
  if (xp >= 80) return { level: 4, title: "Story Architect" };
  if (xp >= 60) return { level: 3, title: "Token Stylist" };
  if (xp >= 20) return { level: 2, title: "Slot Crafter" };
  return { level: 1, title: "Portfolio Explorer" };
}

interface StudioQuestContextValue {
  completedIds: ReadonlySet<QuestMissionId>;
  xp: number;
  maxXp: number;
  rank: { level: number; title: string };
  lastUnlockedTitle: string | null;
  completeMission: (id: QuestMissionId) => void;
  resetQuest: () => void;
}

const FALLBACK_CONTEXT: StudioQuestContextValue = {
  completedIds: new Set<QuestMissionId>(),
  xp: 0,
  maxXp: MAX_QUEST_XP,
  rank: { level: 1, title: "Portfolio Explorer" },
  lastUnlockedTitle: null,
  completeMission: () => {},
  resetQuest: () => {},
};

const StudioQuestContext =
  createContext<StudioQuestContextValue>(FALLBACK_CONTEXT);

export function StudioQuestProvider({ children }: { children: ReactNode }) {
  const [completedIds, setCompletedIds] = useState<Set<QuestMissionId>>(
    () => new Set(),
  );
  const [lastUnlockedTitle, setLastUnlockedTitle] = useState<string | null>(
    null,
  );

  const completeMission = useCallback((id: QuestMissionId) => {
    setCompletedIds((prev) => {
      if (prev.has(id)) {
        return prev;
      }
      const next = new Set(prev);
      next.add(id);
      const found = STUDIO_QUEST_MISSIONS.find((item) => item.id === id);
      if (found) {
        setLastUnlockedTitle(`${found.shortLabel} (+${found.xp} XP)`);
      }
      return next;
    });
  }, []);

  const resetQuest = useCallback(() => {
    setCompletedIds(new Set());
    setLastUnlockedTitle(null);
  }, []);

  const value = useMemo<StudioQuestContextValue>(() => {
    const xp = STUDIO_QUEST_MISSIONS.reduce(
      (sum, mission) => (completedIds.has(mission.id) ? sum + mission.xp : sum),
      0,
    );
    return {
      completedIds,
      xp,
      maxXp: MAX_QUEST_XP,
      rank: resolveQuestRank(xp),
      lastUnlockedTitle,
      completeMission,
      resetQuest,
    };
  }, [completedIds, lastUnlockedTitle, completeMission, resetQuest]);

  return (
    <StudioQuestContext.Provider value={value}>
      {children}
    </StudioQuestContext.Provider>
  );
}

export function useStudioQuest(): StudioQuestContextValue {
  return useContext(StudioQuestContext);
}

