/**
 * src/ai-providers/claude-code.js
 *
 * Implementation for Claude Code CLI integration.
 * Allows using Claude models through the CLI without requiring an API key.
 *
 * Source: https://github.com/eyaltoledano/claude-task-master/blob/main/docs/examples/claude-code-usage.md
 */

import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import { BaseAIProvider } from './base-provider.js';

const execAsync = promisify(exec);

// Simple logging function to avoid circular dependencies
const log = (level, message, context = {}) => {
	const timestamp = new Date().toISOString();
	const logMessage = `[${timestamp}] ${level.toUpperCase()}: ${message}`;

	if (level === 'error') {
		console.error(logMessage, context);
	} else if (level === 'warn') {
		console.warn(logMessage, context);
	} else {
		console.log(logMessage, context);
	}
};

/**
 * Claude Code CLI Provider
 * Integrates with the Claude Code CLI tool for AI interactions
 */
export class ClaudeCodeProvider extends BaseAIProvider {
	constructor() {
		super();
		this.name = 'ClaudeCode';
		this.supportedModels = ['opus', 'sonnet'];
		this.cliPath = 'claude';
		this._sessionCache = new Map();
	}

	/**
	 * Override auth validation - Claude Code CLI doesn't require API key
	 * @param {object} params - Parameters to validate
	 */
	validateAuth(params) {
		// Claude Code CLI uses its own authentication, no API key needed
		return true;
	}

	/**
	 * Validates Claude Code specific parameters
	 * @param {object} params - Parameters to validate
	 */
	validateParams(params) {
		// Skip API key validation but validate other params
		if (!params.modelId) {
			throw new Error(`${this.name} Model ID is required`);
		}

		if (!this.supportedModels.includes(params.modelId)) {
			throw new Error(
				`${this.name} Model '${params.modelId}' not supported. Available: ${this.supportedModels.join(', ')}`
			);
		}

		this.validateOptionalParams(params);
	}

	/**
	 * Checks if Claude Code CLI is installed and authenticated
	 * @returns {Promise<boolean>} True if CLI is available
	 */
	async isCliAvailable() {
		try {
			const { stdout } = await execAsync(`${this.cliPath} --version`);
			log('debug', `Claude Code CLI version: ${stdout.trim()}`);
			return true;
		} catch (error) {
			log('warn', 'Claude Code CLI not found or not authenticated');
			return false;
		}
	}

	/**
	 * Creates a session identifier for conversation continuity
	 * @param {object} params - Request parameters
	 * @returns {string} Session ID
	 */
	createSessionId(params) {
		const key = JSON.stringify({
			modelId: params.modelId,
			temperature: params.temperature,
			maxTokens: params.maxTokens
		});
		return Buffer.from(key).toString('base64').slice(0, 16);
	}

	/**
	 * Executes Claude Code CLI command with proper error handling
	 * @param {string[]} args - CLI arguments
	 * @param {string} input - Input text to send
	 * @returns {Promise<string>} CLI output
	 */
	async executeCli(args, input = '') {
		return new Promise((resolve, reject) => {
			const child = spawn(this.cliPath, args, {
				stdio: ['pipe', 'pipe', 'pipe']
			});

			let stdout = '';
			let stderr = '';

			child.stdout.on('data', (data) => {
				stdout += data.toString();
			});

			child.stderr.on('data', (data) => {
				stderr += data.toString();
			});

			child.on('close', (code) => {
				if (code === 0) {
					resolve(stdout);
				} else {
					reject(new Error(`Claude CLI exited with code ${code}: ${stderr}`));
				}
			});

			child.on('error', (error) => {
				reject(new Error(`Failed to start Claude CLI: ${error.message}`));
			});

			if (input) {
				child.stdin.write(input);
				child.stdin.end();
			}
		});
	}

	/**
	 * Formats messages for Claude Code CLI input
	 * @param {Array} messages - Message array
	 * @returns {string} Formatted prompt
	 */
	formatMessages(messages) {
		return messages
			.map((msg) => {
				const role = msg.role === 'assistant' ? 'Claude' : 'Human';
				return `${role}: ${msg.content}`;
			})
			.join('\n\n');
	}

	/**
	 * Creates and returns a mock client for compatibility with base provider
	 * @param {object} params - Parameters for client initialization
	 * @returns {Function} Mock client function
	 */
	getClient(params) {
		return (modelId) => ({
			modelId,
			provider: 'claude-code',
			...params
		});
	}

	/**
	 * Generates text using Claude Code CLI
	 * @param {object} params - Generation parameters
	 * @returns {Promise<object>} Generation result
	 */
	async generateText(params) {
		try {
			this.validateParams(params);
			this.validateMessages(params.messages);

			if (!(await this.isCliAvailable())) {
				throw new Error(
					'Claude Code CLI is not available. Please install and authenticate first.'
				);
			}

			log(
				'debug',
				`Generating text with Claude Code CLI using model: ${params.modelId}`
			);

			const prompt = this.formatMessages(params.messages);
			const args = ['--model', params.modelId, '--no-conversation-history'];

			if (params.maxTokens) {
				args.push('--max-tokens', params.maxTokens.toString());
			}

			if (params.temperature !== undefined) {
				args.push('--temperature', params.temperature.toString());
			}

			const result = await this.executeCli(args, prompt);

			log('debug', `Claude Code CLI generateText completed successfully`);

			return {
				text: result.trim(),
				usage: {
					inputTokens: null, // Claude Code CLI doesn't provide token counts
					outputTokens: null,
					totalTokens: null
				}
			};
		} catch (error) {
			this.handleError('text generation', error);
		}
	}

	/**
	 * Streams text using Claude Code CLI
	 * Note: This is a simulation as Claude Code CLI doesn't support streaming
	 * @param {object} params - Stream parameters
	 * @returns {Promise<AsyncIterable>} Stream-like object
	 */
	async streamText(params) {
		try {
			log(
				'warn',
				'Claude Code CLI does not support streaming. Falling back to regular generation.'
			);

			const result = await this.generateText(params);

			// Create a simple async iterable that yields the full result
			const stream = {
				async *[Symbol.asyncIterator]() {
					const chunks = result.text.split(' ');
					for (const chunk of chunks) {
						yield {
							type: 'text-delta',
							textDelta: chunk + ' '
						};
						// Small delay to simulate streaming
						await new Promise((resolve) => setTimeout(resolve, 10));
					}
					yield {
						type: 'finish',
						usage: result.usage
					};
				}
			};

			log('debug', 'Claude Code CLI streamText simulation completed');
			return stream;
		} catch (error) {
			this.handleError('text streaming', error);
		}
	}

	/**
	 * Generates structured objects using Claude Code CLI
	 * Note: Limited support - relies on prompt engineering
	 * @param {object} params - Object generation parameters
	 * @returns {Promise<object>} Generated object result
	 */
	async generateObject(params) {
		try {
			this.validateParams(params);
			this.validateMessages(params.messages);

			if (!params.schema) {
				throw new Error('Schema is required for object generation');
			}

			log(
				'debug',
				`Generating object with Claude Code CLI using model: ${params.modelId}`
			);

			// Add schema instructions to the last message
			const schemaPrompt = `Please respond with a valid JSON object that matches this schema:
${JSON.stringify(params.schema, null, 2)}

Your response should contain ONLY the JSON object, no explanations or markdown formatting.`;

			const enhancedMessages = [
				...params.messages,
				{ role: 'user', content: schemaPrompt }
			];

			const textResult = await this.generateText({
				...params,
				messages: enhancedMessages
			});

			// Attempt to parse the JSON response
			let parsedObject;
			try {
				// Clean up potential markdown formatting
				const cleanText = textResult.text
					.replace(/```json\n?/g, '')
					.replace(/```\n?/g, '')
					.trim();

				parsedObject = JSON.parse(cleanText);
			} catch (parseError) {
				throw new Error(`Failed to parse JSON response: ${parseError.message}`);
			}

			log('debug', `Claude Code CLI generateObject completed successfully`);

			return {
				object: parsedObject,
				usage: textResult.usage
			};
		} catch (error) {
			this.handleError('object generation', error);
		}
	}

	/**
	 * Gets available models from Claude Code CLI
	 * @returns {Promise<string[]>} Available model names
	 */
	async getAvailableModels() {
		try {
			if (!(await this.isCliAvailable())) {
				return this.supportedModels;
			}

			// Try to get models from CLI (if supported in future versions)
			try {
				const { stdout } = await execAsync(`${this.cliPath} --help`);
				// Parse help output for model information
				const modelMatch = stdout.match(/--model\s+\[([^\]]+)\]/);
				if (modelMatch) {
					return modelMatch[1].split('|').map((m) => m.trim());
				}
			} catch (error) {
				log('debug', 'Could not fetch models from CLI, using defaults');
			}

			return this.supportedModels;
		} catch (error) {
			log('warn', `Failed to get available models: ${error.message}`);
			return this.supportedModels;
		}
	}

	/**
	 * Health check for the Claude Code CLI integration
	 * @returns {Promise<object>} Health status
	 */
	async healthCheck() {
		const isAvailable = await this.isCliAvailable();
		const models = await this.getAvailableModels();

		return {
			provider: this.name,
			available: isAvailable,
			models,
			requiresApiKey: false,
			features: {
				generateText: true,
				streamText: false, // Simulated only
				generateObject: true, // Limited support
				conversation: false // No built-in conversation history
			}
		};
	}
}
