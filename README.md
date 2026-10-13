# dsh-plugin-stream

Official DeepSeek Harness (DSH) live streaming, conversational heartbeat & instant steer priority plugin.

## Problem Solved

When agents (especially on complex models or fast inference providers like OmniRoute Gemini 3.8 Flash) execute long chains of tool calls (reading 10+ files, grepping, editing), standard DSH loops remain silent until the entire turn concludes, causing 10–40 minute dead silences.

**dsh-plugin-stream** introduces:
1. **Intelligent Live Heartbeat**: Monitors consecutive tool calls without conversational updates. When the heartbeat threshold (default: 4 tool calls) is reached, it seamlessly injects an internal prompt demanding an immediate 1–2 sentence status report for the user.
2. **Transparent Protocol Injection**: Injects high-priority rules into `system-prompt/assemble` to enforce progressive status disclosure.
3. **Immediate Steer Priority**: Coordinates with DSH's native `steer` and inbox pipeline so urgent interruptions interrupt waiting loops and get answered immediately.

## Installation

Add to your DeepSeek Harness Cordis configuration or plugin registry:

```yaml
- name: "dsh-plugin-stream"
  config:
    toolCallHeartbeat: 4
    idleNudgeMs: 45000
```

Or clone directly into your DSH plugins workspace:
```bash
git clone git@github.com:surtr85/dsh-plugin-stream.git
```

## Configuration Options

| Option | Type | Default | Description |
|---|---|---|---|
| `toolCallHeartbeat` | `number` | `4` | Max tool calls allowed before forcing a progress report. |
| `idleNudgeMs` | `number` | `45000` | Max elapsed time before reminding the agent to report. |
| `systemInstruction` | `string` | Custom rule | Custom system prompt protocol injected into each turn. |

## License

MIT © [Sajjad <surtr85>](https://github.com/surtr85)
