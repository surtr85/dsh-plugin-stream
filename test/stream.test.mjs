import test from "node:test";
import assert from "node:assert/strict";
import { apply } from "../index.js";

test("dsh-plugin-stream mounts without crashing", () => {
  const events = new Map();
  const mockCtx = {
    logger: { info: () => {}, warn: () => {} },
    on(event, handler) {
      events.set(event, handler);
    },
  };

  apply(mockCtx, { toolCallHeartbeat: 2 });

  assert.ok(events.has("system-prompt/assemble"));
  assert.ok(events.has("agent/pre-step"));
  assert.ok(events.has("tools/post-execute"));
  assert.ok(events.has("agent/turn-stopping"));
  assert.ok(events.has("agent/disposed"));
});
