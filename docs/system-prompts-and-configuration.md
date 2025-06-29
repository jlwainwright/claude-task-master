# TaskMaster System Prompts & Configuration Files

This document provides a comprehensive overview of all files containing system prompts, AI instructions, and task configurations in the TaskMaster system.

## 📋 System Prompts & Task Configuration Files

### **1. Core System Prompts** (`scripts/modules/task-manager/`)

#### **Task Creation Prompts**
- **`add-task.js`** (Lines 833, 867)
  - Main task creation system prompt: *"You are a helpful assistant that creates well-structured tasks..."*
  - User prompt template for generating task details
  - Handles dependency analysis and context building
  - Generates comprehensive task data with AI assistance

#### **Task Expansion Prompts** 
- **`expand-task.js`** (Lines 59, 533, 550)
  - Subtask breakdown system prompt: *"You are an AI assistant helping with task breakdown for software development..."*
  - Research-focused expansion prompts
  - JSON structure validation prompts
  - Handles sequential subtask ID generation

#### **Task Analysis Prompts**
- **`analyze-task-complexity.js`** (Line 347)
  - Complexity analysis prompt: *"You are an expert software architect and project manager..."*
  - Analyzes task difficulty and resource requirements
  - Provides complexity scoring and recommendations

#### **Task Update Prompts**
- **`update-task-by-id.js`** (Line 353)
- **`update-subtask-by-id.js`** (Line 191) 
- **`update-tasks.js`** (Line 327)
  - Context-aware task updating prompts
  - Maintains task consistency during updates
  - Handles dependency chain updates

#### **PRD Processing Prompts**
- **`parse-prd.js`** (Line 169)
  - Product Requirements Document analysis prompt
  - Converts PRD content into structured task lists
  - Handles dependency extraction and prioritization

### **2. Configuration Files**

#### **Main Configuration**
- **`.taskmaster/config.json`** - AI model configurations, provider settings
  ```json
  {
    "models": {
      "main": {
        "provider": "anthropic",
        "modelId": "claude-sonnet-4-20250514",
        "maxTokens": 50000,
        "temperature": 0.2
      },
      "research": {
        "provider": "perplexity",
        "modelId": "sonar-pro",
        "maxTokens": 8700,
        "temperature": 0.1
      }
    }
  }
  ```

- **`.taskmaster/docs/prd.txt`** - Project requirements document
  - Contains system architecture documentation
  - Defines core features and technical requirements
  - Serves as context for AI task generation

- **`.taskmaster/templates/example_prd.txt`** - PRD template structure
  - Template for creating new project requirements
  - Includes sections for overview, features, architecture
  - Guidelines for development roadmap creation

#### **Task Data**
- **`.taskmaster/tasks/tasks.json`** - Central task database with all task definitions
  ```json
  {
    "tasks": [
      {
        "id": 1,
        "title": "Task Title",
        "description": "Task description",
        "status": "pending",
        "dependencies": [],
        "priority": "high",
        "details": "Implementation details",
        "testStrategy": "Testing approach",
        "subtasks": []
      }
    ]
  }
  ```

- **`.taskmaster/tasks/task_*.txt`** - Individual task files (auto-generated)
  - Human-readable task format
  - Contains task metadata and details
  - Generated from tasks.json data

### **3. AI Service Integration**

#### **Unified AI Services**
- **`scripts/modules/ai-services-unified.js`** - Central AI provider management
  - Handles provider selection and configuration
  - Manages API calls and response processing
  - Includes retry logic and error handling

- **`src/ai-providers/`** - Individual provider implementations
  - `anthropic.js` - Claude models
  - `claude-code.js` - Claude Code CLI integration
  - `gemini-cli.js` - Google Gemini CLI integration
  - `openai.js` - OpenAI models
  - `perplexity.js` - Perplexity research models
  - And more providers...

### **4. Task Structure Templates**

#### **Zod Schemas** (in various task-manager files)

**Task Schema** (`add-task.js`):
```javascript
const AiTaskDataSchema = z.object({
  title: z.string().describe('Clear, concise title for the task'),
  description: z.string().describe('A one or two sentence description of the task'),
  details: z.string().describe('In-depth implementation details, considerations, and guidance'),
  testStrategy: z.string().describe('Detailed approach for verifying task completion'),
  dependencies: z.array(z.number()).optional().describe('Array of task IDs that this task depends on')
});
```

**Subtask Schema** (`expand-task.js`):
```javascript
const subtaskSchema = z.object({
  id: z.number().int().positive().describe('Sequential subtask ID starting from 1'),
  title: z.string().min(5).describe('Clear, specific title for the subtask'),
  description: z.string().min(10).describe('Detailed description of the subtask'),
  dependencies: z.array(z.number().int()).describe('IDs of prerequisite subtasks within this expansion'),
  details: z.string().min(20).describe('Implementation details and guidance'),
  status: z.string().describe('The current status of the subtask (should be pending initially)'),
  testStrategy: z.string().optional().describe('Approach for testing this subtask')
});
```

### **5. Key System Prompt Locations**

```bash
# Find all system prompts
grep -n "You are" scripts/modules/task-manager/*.js

# Main prompt locations:
scripts/modules/task-manager/add-task.js:833        # Task creation
scripts/modules/task-manager/expand-task.js:59     # Task breakdown  
scripts/modules/task-manager/analyze-task-complexity.js:347  # Complexity analysis
scripts/modules/task-manager/update-task-by-id.js:353       # Task updates
scripts/modules/task-manager/parse-prd.js:169              # PRD parsing
```

### **6. Detailed System Prompts**

#### **Task Creation System Prompt** (`add-task.js:833`)
```javascript
"You are a helpful assistant that creates well-structured tasks for a software development project. Generate a single new task based on the user's description, adhering strictly to the provided JSON schema. Pay special attention to dependencies between tasks, ensuring the new task correctly references any tasks it depends on."
```

#### **Task Breakdown System Prompt** (`expand-task.js:59`)
```javascript
`You are an AI assistant helping with task breakdown for software development.
You need to break down a high-level task into ${subtaskCount} specific subtasks that can be implemented one by one.

Subtasks should:
1. Be specific and actionable implementation steps
2. Follow a logical sequence
3. Each handle a distinct part of the parent task
4. Include clear guidance on implementation approach
5. Have appropriate dependency chains between subtasks (using the new sequential IDs)
6. Collectively cover all aspects of the parent task

For each subtask, provide:
- id: Sequential integer starting from the provided nextSubtaskId
- title: Clear, specific title
- description: Detailed description
- dependencies: Array of prerequisite subtask IDs (use the new sequential IDs)
- details: Implementation details
- testStrategy: Optional testing approach

Respond ONLY with a valid JSON object containing a single key "subtasks" whose value is an array matching the structure described. Do not include any explanatory text, markdown formatting, or code block markers.`
```

#### **Complexity Analysis System Prompt** (`analyze-task-complexity.js:347`)
```javascript
'You are an expert software architect and project manager analyzing task complexity. Respond only with the requested valid JSON array.'
```

#### **Task Update System Prompt** (`update-task-by-id.js:353`)
```javascript
`You are an AI assistant helping to update a software development task based on new context.

Your role is to:
1. Analyze the current task and its context
2. Integrate the new information provided by the user
3. Update the task appropriately while maintaining consistency
4. Preserve important existing information unless explicitly changed
5. Ensure the updated task remains well-structured and actionable

Respond ONLY with a valid JSON object matching the provided schema.`
```

### **7. Configuration Structure**

The system uses a hierarchical configuration approach:

#### **Level 1: Global Settings** (`.taskmaster/config.json`)
- AI model configurations
- Provider settings and credentials
- Global preferences and defaults

#### **Level 2: Project Context** (`.taskmaster/docs/prd.txt`)
- Project-specific requirements
- Technical architecture details
- Feature specifications

#### **Level 3: Task Templates** (`.taskmaster/templates/`)
- Reusable task and PRD templates
- Standard structures and formats

#### **Level 4: AI Provider Configs** (`src/ai-providers/`)
- Provider-specific implementations
- Authentication and API handling
- Model-specific configurations

#### **Level 5: Runtime Prompts** (task-manager modules)
- Dynamically generated prompts
- Context-aware instructions
- Task-specific guidance

### **8. AI Provider Integration**

#### **Supported Providers**
- **Anthropic** - Claude models (primary)
- **Claude Code CLI** - Local Claude integration
- **Google Gemini CLI** - Local Gemini integration
- **OpenAI** - GPT models
- **Perplexity** - Research and analysis
- **Google AI** - Gemini models via API
- **Azure OpenAI** - Enterprise OpenAI
- **AWS Bedrock** - Multiple models via AWS
- **Ollama** - Local model hosting
- **OpenRouter** - Multiple model access

#### **Provider Configuration Pattern**
```javascript
const provider = new ProviderClass();
const result = await provider.generateText({
  modelId: 'model-name',
  messages: [{ role: 'user', content: 'prompt' }],
  maxTokens: 1000,
  temperature: 0.2
});
```

### **9. Usage Patterns**

#### **Task Creation Flow**
1. User provides task description
2. System analyzes existing tasks for context
3. AI generates structured task data using prompts from `add-task.js`
4. Validation against Zod schemas
5. Storage in `tasks.json` and generation of task files

#### **Task Expansion Flow**
1. User selects task to expand
2. System loads task context and dependencies
3. AI breaks down task using prompts from `expand-task.js`
4. Subtasks validated and assigned sequential IDs
5. Parent task updated with subtask references

#### **Configuration Loading**
1. Load global config from `.taskmaster/config.json`
2. Detect and initialize configured AI providers
3. Load project context from PRD files
4. Apply runtime configurations based on operation type

### **10. Customization Points**

#### **Adding New Prompts**
- Create new prompt functions in appropriate task-manager modules
- Follow existing patterns for system/user prompt separation
- Include Zod schema validation for AI responses

#### **Modifying AI Behavior**
- Update system prompts in task-manager modules
- Adjust model parameters in `.taskmaster/config.json`
- Customize provider settings in `ai-services-unified.js`

#### **Extending Task Structure**
- Modify Zod schemas in task-manager modules
- Update task templates in `.taskmaster/templates/`
- Adjust prompt instructions to include new fields

All prompts are designed to work with the JSON schema validation system and follow consistent patterns for task creation, expansion, and management. The system emphasizes structured output, clear instructions, and context-aware AI assistance for software development task management.