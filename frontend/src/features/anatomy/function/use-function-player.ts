"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";

import { modelsQuery, runSimulation } from "@/lib/api/queries";

import { useWorkspace } from "../store";

/**
 * Runs a model on the server and hands its output to the 3D playback. Only the latest
 * request (from any caller) wins, so quickly moving a slider never shows an older run.
 */
let latestTicket = 0;

export function useFunctionPlayer() {
  const qc = useQueryClient();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const play = useCallback(
    async (modelId: string, parameters: Record<string, number> = {}) => {
      const ticket = ++latestTicket;
      setPending(true);
      setError(null);
      try {
        const [models, result] = await Promise.all([
          qc.ensureQueryData(modelsQuery),
          runSimulation(modelId, parameters),
        ]);
        if (ticket !== latestTicket) return;
        const model = models.find((m) => m.id === modelId);
        if (!model) throw new Error(`Unknown model ${modelId}`);
        const ws = useWorkspace.getState();
        ws.startPlayback({
          modelId,
          modelName: model.name,
          time: result.time,
          series: result.series,
          bindings: model.animations,
          rate: model.playback_rate,
          timeUnit: model.time_unit,
          parameters: result.parameters,
          metrics: result.metrics,
          warnings: result.warnings,
        });
      } catch (e) {
        if (ticket === latestTicket) setError(e as Error);
      } finally {
        if (ticket === latestTicket) setPending(false);
      }
    },
    [qc],
  );

  return { play, pending, error };
}
