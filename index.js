export const name = "dsh-plugin-stream";

/**
 * Intelligent & Minimalist Stream Plugin:
 * - Zero context pollution: No verbose pre-tool system prompts.
 * - Full speed: Tools run at native speed without artificial delays or interruptions.
 * - Urgent message steering: Immediately prioritized when received.
 * - Heartbeat: Only nudges after 90 seconds of continuous silent execution.
 */
const DEFAULT_CONFIG = {
  heartbeatMs: 90000, // 90 seconds of continuous silence before check-in
};

export function apply(ctx, options = {}) {
  const config = { ...DEFAULT_CONFIG, ...options };
  const turnTimers = new Map();

  ctx.on("turn/start", ({ agent }) => {
    if (agent && agent.id) {
      turnTimers.set(agent.id, {
        startedAt: Date.now(),
        lastHeartbeat: Date.now(),
      });
    }
  });

  ctx.on("turn/end", ({ agent }) => {
    if (agent && agent.id) {
      turnTimers.delete(agent.id);
    }
  });

  // Pre-step hook: only check if turn is truly taking too long silently
  ctx.on("agent/pre-step", async ({ agent, signal }, next) => {
    const decision = await next();
    if (decision.kind === "reject" || signal?.aborted) return decision;

    const timer = turnTimers.get(agent.id);
    const now = Date.now();

    // Check if urgent steered message is waiting in inbox
    if (agent.inbox?.nextStep?.length > 0) {
      // Steered message is present; model will naturally see it in next turn step
      return decision;
    }

    // Only nudge if running continuously for > heartbeatMs without any check-in
    if (timer && (now - timer.lastHeartbeat >= config.heartbeatMs)) {
      timer.lastHeartbeat = now;
      const elapsedMins = Math.round((now - timer.startedAt) / 60000);
      const note = {
        role: "user",
        content: `[System Notice: You have been executing tasks for ${elapsedMins || 1} min. Please briefly state your current status in 1 sentence for the user before continuing.]`
      };
      return {
        ...decision,
        messages: [...(decision.messages || []), note]
      };
    }

    return decision;
  }, { prepend: true });

  ctx.on("agent/disposed", ({ agent }) => {
    if (agent && agent.id) turnTimers.delete(agent.id);
  });
}
