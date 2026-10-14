import { createUserMessage } from "@deepseek-ai/dsh-llm";

export const name = "dsh-plugin-stream";

/**
 * Clean & Non-intrusive stream plugin:
 * - Does NOT inject spammy system prompts before every tool
 * - Only nudges when truly silent for extended operations (> 8 sequential tool calls)
 * - Ensures incoming urgent steered messages take immediate turn priority
 */
const DEFAULT_CONFIG = {
  maxSilentToolCalls: 8,
};

export function apply(ctx, options = {}) {
  const config = { ...DEFAULT_CONFIG, ...options };
  const agentState = new Map();

  function getOrInitState(agentId) {
    if (!agentState.has(agentId)) {
      agentState.set(agentId, { toolCalls: 0 });
    }
    return agentState.get(agentId);
  }

  // Intercept pre-step: only nudge if a very long tool chain executed without a word
  ctx.on("agent/pre-step", async ({ agent, signal }, next) => {
    const decision = await next();
    if (decision.kind === "reject" || signal.aborted) return decision;

    const state = getOrInitState(agent.id);
    if (state.toolCalls >= config.maxSilentToolCalls) {
      state.toolCalls = 0;
      const nudge = createUserMessage({
        content: [{ type: "text", text: "[Progress Check-in]: Briefly summarize your progress so far in one sentence before proceeding." }],
        source: { kind: "dsh-plugin-stream", form: "heartbeat" }
      });
      return {
        ...decision,
        messages: [...decision.messages, nudge]
      };
    }
    return decision;
  }, { prepend: true });

  ctx.on("tools/post-execute", async (exec, result, next) => {
    if (exec && exec.agent) {
      const state = getOrInitState(exec.agent.id);
      state.toolCalls += 1;
    }
    return next();
  });

  ctx.on("agent/turn-stopping", async ({ agent }) => {
    const state = getOrInitState(agent.id);
    state.toolCalls = 0;
  });

  ctx.on("agent/disposed", ({ agent }) => {
    if (agent && agent.id) agentState.delete(agent.id);
  });
}
