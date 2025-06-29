# Google Gemini CLI Integration

This document describes the Google Gemini CLI integration for the Task Master AI system.

## Overview

The Gemini CLI integration (`GeminiCLIProvider`) allows you to use Google's Gemini models through the Gemini CLI without requiring API key management in TaskMaster. This integration leverages the powerful capabilities of Google's Gemini models including multimodal support, large context windows, and advanced reasoning capabilities.

## Prerequisites

1. **Google Gemini CLI Installation**: Install the Gemini CLI tool
   ```bash
   # Via npm (requires Node.js 18+)
   npm install -g @google/gemini-cli
   
   # Or via npx
   npx https://github.com/google-gemini/gemini-cli
   ```

2. **Authentication**: Configure authentication using one of these methods:
   - **Google Account**: Provides 60 requests/minute, 1,000 requests/day
   - **API Key**: Generate from [Google AI Studio](https://makersuite.google.com/app/apikey)
     ```bash
     export GEMINI_API_KEY="your_api_key_here"
     ```

3. **Supported Models**: Currently supports:
   - `gemini-1.5-pro-latest` - Latest Pro model with advanced capabilities
   - `gemini-1.5-flash` - Fast, efficient model for quick responses
   - `gemini-pro` - Standard production model
   - `gemini-1.5-pro` - Pro model with enhanced reasoning
   - `gemini-2.0-flash-exp` - Experimental next-generation model

## Configuration

### Basic Configuration

```json
{
  "models": {
    "main": {
      "provider": "gemini-cli",
      "modelId": "gemini-1.5-pro-latest",
      "maxTokens": 32000,
      "temperature": 0.7
    }
  }
}
```

### Advanced Configuration

```json
{
  "models": {
    "main": {
      "provider": "gemini-cli",
      "modelId": "gemini-1.5-flash",
      "maxTokens": 16000,
      "temperature": 0.3
    },
    "multimodal": {
      "provider": "gemini-cli",
      "modelId": "gemini-1.5-pro-latest",
      "maxTokens": 64000,
      "temperature": 0.5
    }
  }
}
```

## Usage Examples

### Basic Text Generation

```javascript
import { GeminiCLIProvider } from '../src/ai-providers/gemini-cli.js';

const provider = new GeminiCLIProvider();

const result = await provider.generateText({
    modelId: 'gemini-1.5-pro-latest',
    messages: [
        { role: 'user', content: 'Explain quantum computing in simple terms' }
    ],
    maxTokens: 2000,
    temperature: 0.7
});

console.log(result.text);
```

### Structured Object Generation

```javascript
import { z } from 'zod';

const schema = z.object({
    summary: z.string(),
    keyPoints: z.array(z.string()),
    difficulty: z.enum(['beginner', 'intermediate', 'advanced']),
    estimatedReadTime: z.number()
});

const result = await provider.generateObject({
    modelId: 'gemini-1.5-flash',
    messages: [
        { role: 'user', content: 'Analyze this technical article and provide structured insights...' }
    ],
    schema: schema,
    objectName: 'articleAnalysis'
});

console.log(result.object);
```

### Multimodal Generation with Files

```javascript
const result = await provider.generateTextWithFiles({
    modelId: 'gemini-1.5-pro-latest',
    messages: [
        { role: 'user', content: 'Analyze these images and documents' }
    ],
    files: [
        '/path/to/image.jpg',
        '/path/to/document.pdf',
        '/path/to/chart.png'
    ]
});

console.log(result.text);
```

### Health Check and Capabilities

```javascript
const health = await provider.healthCheck();
console.log(`Provider available: ${health.available}`);
console.log(`Authenticated: ${health.authenticated}`);
console.log(`Supported models: ${health.models.join(', ')}`);
console.log(`Max context tokens: ${health.maxContextTokens}`);
console.log(`Features: ${JSON.stringify(health.features, null, 2)}`);
```

## Features

### ✅ Fully Supported Features

- **Text Generation**: Complete support for text generation
- **Object Generation**: JSON object generation with schema validation
- **Multimodal Support**: Images, PDFs, and document analysis
- **Large Context**: Up to 1M tokens context window
- **Code Generation**: Advanced programming assistance
- **Conversation**: Multi-turn conversation support
- **Search Integration**: Can leverage Google Search capabilities
- **Error Handling**: Comprehensive error handling with context
- **Performance Tracking**: Built-in metrics and performance monitoring
- **Rate Limiting**: Configurable rate limiting between requests

### ⚠️ Limited Features

- **Streaming**: Simulated streaming (not true real-time streaming)
- **Parameter Control**: Temperature/top-p may not be directly supported
- **Token Counting**: No usage metrics from CLI

### ❌ Current Limitations

- **Custom Endpoints**: Uses Gemini CLI exclusively
- **API Key Management**: CLI handles authentication
- **Cost Tracking**: No usage cost information available
- **Fine-tuning**: No support for custom model training

## Performance Optimizations

### Rate Limiting

The provider includes built-in rate limiting to respect CLI limitations:

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

### Context Management

Optimize for large context windows:

```javascript
// Gemini CLI supports very large contexts
const sessionId = provider.createSessionId({
    modelId: 'gemini-1.5-pro-latest',
    temperature: 0.7,
    maxTokens: 100000  // Large context window
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
# Text generation
gemini --prompt "Your message here" --model gemini-1.5-pro-latest

# Multimodal with files
gemini --prompt "@image.jpg @document.pdf Analyze these files" --model gemini-1.5-pro-latest
```

### Authentication Handling

The provider checks authentication in this order:
1. `GEMINI_API_KEY` environment variable
2. Google account authentication (via CLI)
3. Interactive authentication prompts

### File Upload Support

Gemini CLI supports file references using the `@` syntax:

```javascript
// Single file
const fileRef = await provider.uploadFile('/path/to/image.jpg');
// Returns: "@/path/to/image.jpg"

// Multiple files in generation
await provider.generateTextWithFiles({
    modelId: 'gemini-1.5-pro-latest',
    messages: [{ role: 'user', content: 'Analyze these files' }],
    files: ['/path/to/image.jpg', '/path/to/data.csv']
});
```

## Advanced Usage Patterns

### Batch Processing

```javascript
const tasks = [
    { prompt: 'Summarize document A', files: ['docA.pdf'] },
    { prompt: 'Analyze image B', files: ['imageB.jpg'] },
    { prompt: 'Review code C', files: ['codeC.js'] }
];

const results = await Promise.all(
    tasks.map(task => provider.generateTextWithFiles({
        modelId: 'gemini-1.5-flash',
        messages: [{ role: 'user', content: task.prompt }],
        files: task.files
    }))
);
```

### Code Analysis

```javascript
const codeAnalysis = await provider.generateObject({
    modelId: 'gemini-1.5-pro-latest',
    messages: [
        { role: 'user', content: 'Analyze this codebase for security vulnerabilities' }
    ],
    files: ['src/main.js', 'src/auth.js', 'src/database.js'],
    schema: {
        type: 'object',
        properties: {
            vulnerabilities: {
                type: 'array',
                items: {
                    type: 'object',
                    properties: {
                        severity: { type: 'string', enum: ['low', 'medium', 'high', 'critical'] },
                        type: { type: 'string' },
                        file: { type: 'string' },
                        line: { type: 'number' },
                        description: { type: 'string' },
                        recommendation: { type: 'string' }
                    }
                }
            },
            overallRisk: { type: 'string', enum: ['low', 'medium', 'high'] },
            summary: { type: 'string' }
        }
    }
});
```

### Research and Analysis

```javascript
const researchResult = await provider.generateText({
    modelId: 'gemini-1.5-pro-latest',
    messages: [
        { 
            role: 'user', 
            content: 'Research the latest developments in quantum computing and provide a comprehensive analysis' 
        }
    ]
});

// Gemini can leverage Google Search for current information
```

## Troubleshooting

### Common Issues

1. **CLI Not Found**
   ```bash
   # Verify installation
   gemini --version
   # Or check help
   gemini --help
   ```

2. **Authentication Errors**
   ```bash
   # Set API key
   export GEMINI_API_KEY="your_key_here"
   # Or use Google account authentication
   gemini # Follow interactive prompts
   ```

3. **File Upload Issues**
   - Ensure files exist and are readable
   - Check file formats are supported (images, PDFs, text files)
   - Verify file paths are absolute or correctly relative

4. **Model Availability**
   ```javascript
   const models = await provider.getAvailableModels();
   console.log('Available models:', models);
   ```

### Performance Tips

1. **Use appropriate models for tasks**:
   - `gemini-1.5-flash` for quick, simple tasks
   - `gemini-1.5-pro-latest` for complex reasoning
   - `gemini-pro` for general production use

2. **Optimize context usage**:
   - Use file references instead of pasting large content
   - Structure prompts efficiently
   - Leverage conversation history appropriately

3. **Handle rate limits**:
   - Implement exponential backoff for failures
   - Use batch processing for multiple requests
   - Monitor authentication quotas

## Integration with TaskMaster Features

### MCP Server Integration

The Gemini CLI provider works seamlessly with TaskMaster's MCP server capabilities:

```json
{
  "mcpServers": {
    "task-master-ai": {
      "command": "node",
      "args": ["./mcp-server/server.js"],
      "env": {
        "GEMINI_API_KEY": "your_key_here"
      }
    }
  }
}
```

### Task Automation

```javascript
// Automated code review
const reviewTask = {
    provider: 'gemini-cli',
    modelId: 'gemini-1.5-pro-latest',
    task: 'code-review',
    files: ['src/**/*.js'],
    output: 'structured'
};

// Document analysis
const docTask = {
    provider: 'gemini-cli',
    modelId: 'gemini-1.5-flash',
    task: 'document-summary',
    files: ['reports/*.pdf'],
    output: 'markdown'
};
```

## Best Practices

### Security

- Never commit API keys to version control
- Use environment variables for sensitive configuration
- Validate all file inputs before processing
- Implement proper error handling to avoid information leakage

### Performance

- Choose the right model for your use case
- Implement caching for repeated queries
- Use batch processing for multiple similar requests
- Monitor and optimize context window usage

### Reliability

- Implement retry logic with exponential backoff
- Handle authentication failures gracefully
- Validate CLI availability before making requests
- Monitor quota usage and implement alerting

## Future Enhancements

The Gemini CLI integration will continue to evolve with:

1. **True Streaming Support** when available in Gemini CLI
2. **Enhanced Parameter Control** for temperature and other settings
3. **Better Token Counting** when CLI provides usage metrics
4. **Advanced Multimodal Features** as they become available
5. **Custom Model Support** for fine-tuned models

---

This integration provides a powerful, API-key-free way to access Google's state-of-the-art Gemini models through TaskMaster, enabling advanced AI capabilities with minimal setup complexity.