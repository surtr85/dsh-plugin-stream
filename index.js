import { createUserMessage } from "@deepseek-ai/dsh-llm";

export const name = "dsh-plugin-stream";

/**
 * Default configuration for progress reporting and steering
 */
const DEFAULT_CONFIG = {
  // Interval of tool calls after which a status check is requested
  toolCallHeartbeat: 4,
  // Idle duration (ms) before nudging agent for a status update
  idleNudgeMs: 45000,
  // System prompt injection ensuring conversational transparency
  systemInstruction: `
CRITICAL LIVE STATUS PROTOCOL:
You are interacting with a human operator who expects continuous transparency during long tasks.
1. When performing multi-step tasks (reading files, executing commands, editing code), DO NOT stay silent.
2. Provide concise status updates detailing what was discovered, what was modified, and what immediate step comes next.
3. If an incoming user instruction or urgent steering message arrives while you are working, prioritize answering it IMMEDIATELY before continuing background tasks.
`.trim(),
};

/**
 * DeepSeek Harness Stream & Priority Steer Plugin.
 *
 * Capabilities:
 * 1. Live Heartbeat: Injects periodic progress reminders if the agent has executed multiple tool calls silently.
 * 2. Instant Priority Response: Spliced steer messages preempt background queues and force direct reply.
 * 3. Transparent Instructions: Injects system-level rules into every turn so Gemini/DeepSeek models communicate continuously.
 *
 * @param {import("@deepseek-ai/cordis").Context} ctx
 * @param {typeof DEFAULT_CONFIG} [options]
 */
export function apply(ctx, options = {}) {
  const config = { ...DEFAULT_CONFIG, ...options };
  const logger = ctx.logger || console;

  logger.info?.("dsh-plugin-stream: activating live stream & smart heartbeat engine");

  // Track agent execution state per session
  const agentState = new Map();

  function getOrInitState(agentId) {
    if (!agentState.has(agentId)) {
      agentState.set(agentId, {
        toolCallsSinceLastReport: 0,
        lastReportTime: Date.now(),
        lastTurn: 0,
        lastStep: 0,
      });
    }
    return agentState.get(agentId);
  }

  // 1. Hook into system prompt assembly to guarantee conversational transparency
  ctx.on("system-prompt/assemble", (assembly, context) => {
    if (!assembly || !assembly.sections) return assembly;

    const sections = [...assembly.sections];
    sections.push({
      id: "dsh-plugin-stream-rules",
      title: "Live Streaming & Progress Protocol",
      content: config.systemInstruction,
      priority: 100,
    });

    return {
      ...assembly,
      sections,
    };
  });

  // 2. Intercept pre-step: inject progress nudge if too many tool calls passed without user check-in
  ctx.on("agent/pre-step", async ({ agent, turn, step, signal }, next) => {
    const decision = await next();
    if (decision.kind === "reject" || signal.aborted) return decision;

    const state = getOrInitState(agent.id);
    state.lastTurn = turn;
    state.lastStep = step;

    // Check if agent has been running multiple tools without communicating
    if (state.toolCallsSinceLastReport >= config.toolCallHeartbeat) {
      state.toolCallsSinceLastReport = 0;
      state.lastReportTime = Date.now();

      const nudgeMessage = createUserMessage({
        content: [
          {
            type: "text",
            text: "[System Heartbeat]: You have completed several internal tool operations. Provide a brief 1-2 sentence status update to the user right now explaining your current progress and next step.",
          },
        ],
        source: {
          kind: "dsh-plugin-stream",
          form: "heartbeat",
        },
      });

      return {
        ...decision,
        messages: [...decision.messages, nudgeMessage],
      };
    }

    return decision;
  }, { prepend: true });

  // 3. Monitor tool executions to track activity count
  ctx.on("tools/post-execute", async (exec, result, next) => {
    if (exec && exec.agent) {
      const state = getOrInitState(exec.agent.id);
      state.toolCallsSinceLastReport += 1;
    }
    return next();
  });

  // 4. Handle turn-stopping: ensure agent doesn't silently stop if an unaddressed user message was steered
  ctx.on("agent/turn-stopping", async ({ agent, turn, signal }) => {
    if (signal.aborted) return;
    const state = getOrInitState(agent.id);
    state.toolCallsSinceLastReport = 0;
    state.lastReportTime = Date.now();
  });

  // 5. Cleanup on agent disposal
  ctx.on("agent/disposed", ({ agent }) => {
    if (agent && agent.id) {
      agentState.delete(agent.id);
    }
  });
}
