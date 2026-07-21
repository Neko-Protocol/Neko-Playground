"use client";

import { useCallback, useState } from "react";
import { nanoid } from "nanoid";
import type {
  ParamBinding,
  Strategy,
  StrategyStep,
} from "@/lib/strategy/types";

export function createEmptyStrategy(name = "Untitled strategy"): Strategy {
  const now = Date.now();
  return {
    id: nanoid(),
    version: 1,
    name,
    isTemplate: false,
    steps: [],
    createdAt: now,
    updatedAt: now,
  };
}

export function cloneAsEditable(template: Strategy): Strategy {
  const now = Date.now();
  return {
    ...template,
    id: nanoid(),
    isTemplate: false,
    createdAt: now,
    updatedAt: now,
  };
}

function pruneBindingsTo(
  params: Record<string, ParamBinding>,
  removedStepId: string
): Record<string, ParamBinding> {
  const next: Record<string, ParamBinding> = {};
  for (const [key, binding] of Object.entries(params)) {
    if (binding.source === "stepOutput" && binding.stepId === removedStepId)
      continue;
    next[key] = binding;
  }
  return next;
}

/**
 * Local, in-memory draft-editing state for the Strategy Composer: add,
 * remove, reorder (via keyboard-operable move up/down, no drag-and-drop
 * dependency), and configure steps. Persisting the draft is a separate
 * concern (useStrategyPersistence.saveStrategy).
 */
export function useStrategyComposerState(initial: Strategy) {
  const [strategy, setStrategy] = useState<Strategy>(initial);

  const touch = useCallback((updater: (s: Strategy) => Strategy) => {
    setStrategy((prev) => ({ ...updater(prev), updatedAt: Date.now() }));
  }, []);

  const addStep = useCallback(
    (step: Omit<StrategyStep, "id">) => {
      touch((s) => ({ ...s, steps: [...s.steps, { ...step, id: nanoid() }] }));
    },
    [touch]
  );

  const removeStep = useCallback(
    (stepId: string) => {
      touch((s) => ({
        ...s,
        steps: s.steps
          .filter((step) => step.id !== stepId)
          .map((step) => ({
            ...step,
            dependsOn: step.dependsOn.filter((id) => id !== stepId),
            params: pruneBindingsTo(step.params, stepId),
          })),
      }));
    },
    [touch]
  );

  const moveStep = useCallback(
    (stepId: string, direction: "up" | "down") => {
      touch((s) => {
        const idx = s.steps.findIndex((step) => step.id === stepId);
        if (idx === -1) return s;
        const swapWith = direction === "up" ? idx - 1 : idx + 1;
        if (swapWith < 0 || swapWith >= s.steps.length) return s;
        const steps = [...s.steps];
        [steps[idx], steps[swapWith]] = [steps[swapWith], steps[idx]];
        return { ...s, steps };
      });
    },
    [touch]
  );

  const updateStepParams = useCallback(
    (stepId: string, params: Record<string, ParamBinding>) => {
      touch((s) => ({
        ...s,
        steps: s.steps.map((step) =>
          step.id === stepId ? { ...step, params } : step
        ),
      }));
    },
    [touch]
  );

  const updateStepDependsOn = useCallback(
    (stepId: string, dependsOn: string[]) => {
      touch((s) => ({
        ...s,
        steps: s.steps.map((step) =>
          step.id === stepId ? { ...step, dependsOn } : step
        ),
      }));
    },
    [touch]
  );

  const rename = useCallback(
    (name: string) => {
      touch((s) => ({ ...s, name }));
    },
    [touch]
  );

  return {
    strategy,
    setStrategy,
    addStep,
    removeStep,
    moveStep,
    updateStepParams,
    updateStepDependsOn,
    rename,
  };
}
