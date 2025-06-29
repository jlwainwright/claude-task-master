# Claude Code CLI Integration

This document describes the Claude Code CLI integration for the Task Master AI system.

## Overview

The Claude Code CLI integration (`ClaudeCodeProvider`) allows you to use Claude models through the Claude Code CLI without requiring an API key. This is particularly useful for developers who have the Claude Code CLI installed and authenticated.

## Prerequisites

1. **Claude Code CLI Installation**: Install the Claude Code CLI tool
2. **Authentication**: Ensure the CLI is properly authenticated
3. **Supported Models**: Currently supports `opus` and `sonnet` models

## Configuration

### Basic Configuration

```json
{
  "models": {
    "main": {
      "provider": "claude-code",
      "modelId": "sonnet",
      "maxTokens": 64000,
      "temperature": 0.2
    }
  }
}
```

### Advanced Configuration

```json
{
  "models": {
    "main": {
      "provider": "claude-code",
      "modelId": "opus",
      "maxTokens": 32000,
      "temperature": 0.7,
      "customSystemPrompt": "You are a helpful coding assistant.",
      "permissionMode": "restricted",
      "allowedTools": ["file_read", "file_write"]
    }
  }
}
```

## Usage Examples

### Basic Text Generation

```javascript
import { ClaudeCodeProvider } from '../src/ai-providers/claude-code.js';

const provider = new ClaudeCodeProvider();

const result = await provider.generateText({
    modelId: 'sonnet',
    messages: [
        { role: 'user', content: 'Explain async/await in JavaScript' }
    ],
    maxTokens: 1000,
    temperature: 0.3
});

console.log(result.text);
```

### Structured Object Generation

```javascript
import { z } from 'zod';

const schema = z.object({
    summary: z.string(),
    keyPoints: z.array(z.string()),
    complexity: z.enum(['low', 'medium', 'high'])
});

const result = await provider.generateObject({
    modelId: 'opus',
    messages: [
        { role: 'user', content: 'Analyze this code complexity...' }
    ],
    schema: schema,
    objectName: 'codeAnalysis'
});

console.log(result.object);
```

### Health Check

```javascript
const health = await provider.healthCheck();
console.log(`Provider available: ${health.available}`);
console.log(`Supported models: ${health.models.join(', ')}`);
console.log(`Features: ${JSON.stringify(health.features, null, 2)}`);
```

## Features

### ✅ Supported Features

- **Text Generation**: Full support for text generation
- **Object Generation**: Limited support using prompt engineering
- **Model Validation**: Validates supported models (opus, sonnet)
- **Error Handling**: Comprehensive error handling with context
- **Performance Tracking**: Built-in metrics and performance monitoring
- **Rate Limiting**: Configurable rate limiting between requests
- **Health Checks**: System health and availability monitoring

### ⚠️ Limited Features

- **Streaming**: Simulated streaming (not true real-time streaming)
- **Conversation History**: No built-in conversation persistence
- **Token Counting**: No usage metrics from CLI

### ❌ Unsupported Features

- **Custom Endpoints**: Uses Claude Code CLI exclusively
- **API Key Authentication**: CLI handles authentication
- **Cost Tracking**: No usage cost information available

## Performance Optimizations

### Rate Limiting

The provider includes built-in rate limiting to prevent overwhelming the CLI:

```javascript
// Configure minimum interval between requests (default: 100ms)
provider._minInterval = 200; // 200ms between requests
```

### Performance Metrics

Access performance metrics for monitoring:

```javascript
const metrics = provider.getMetrics();
console.log(`Success rate: ${metrics.successRate}%`);
console.log(`Average latency: ${metrics.averageLatency}ms`);
console.log(`Total requests: ${metrics.requests}`);
```

### Session Management

The provider automatically manages sessions for conversation continuity:

```javascript
// Sessions are automatically created based on parameters
const sessionId = provider.createSessionId({
    modelId: 'opus',
    temperature: 0.7,
    maxTokens: 1000
});
```

## Error Handling

The provider includes enhanced error handling with detailed context:

```javascript
try {
    const result = await provider.generateText(params);
} catch (error) {
    console.error(`Provider: ${error.provider}`);
    console.error(`Operation: ${error.operation}`);
    console.error(`Context:`, error.context);
    console.error(`Original error:`, error.originalError);
}
```

## CLI Integration Details

### Command Structure

The provider constructs CLI commands as follows:

```bash
claude --model sonnet --max-tokens 1000 --temperature 0.7 --no-conversation-history
```

### Input Formatting

Messages are formatted for CLI input:

```
Human: Your question here

Claude: Assistant response