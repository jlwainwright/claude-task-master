/**
 * src/ai-providers/gemini-cli.js
 *
 * Implementation for Google Gemini CLI integration.
 * Allows using Gemini models through the CLI without requiring API key management.
 * 
 * Source: https://github.com/google-gemini/gemini-cli
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
 * Google Gemini CLI Provider
 * Integrates with the Google Gemini CLI tool for AI interactions
 */
export class GeminiCLIProvider extends BaseAIProvider {
	constructor() {
		super();
		this.name = 'GeminiCLI';
		this.supportedModels = [
			'gemini-2.5-pro',
			'gemini-2.5-flash',
			'gemini-2.5-flash-lite-preview-06-17',
			'gemini-2.0-flash',
			'gemini-1.5-pro-latest',
			'gemini-1.5-flash',
			'gemini-1.5-pro',
			'gemini-pro'
		];
		this.cliPath = 'gemini';
		this._sessionCache = new Map();
		this._maxContextTokens = 1000000; // Gemini CLI supports large contexts
	}

	/**
	 * Override auth validation - Gemini CLI handles its own authentication
	 * @param {object} params - Parameters to validate
	 */
	validateAuth(params) {
		// Gemini CLI uses its own authentication (API key or Google account), no API key needed
		return true;
	}

	/**
	 * Validates Gemini CLI specific parameters
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
	 * Checks if Gemini CLI is installed and available
	 * @returns {Promise<boolean>} True if CLI is available
	 */
	async isCliAvailable() {
		try {
			const { stdout } = await execAsync(`${this.cliPath} --version`);
			log('debug', `Gemini CLI version: ${stdout.trim()}`);
			return true;
		} catch (error) {
			// Try alternative command if --version fails
			try {
				const { stdout } = await execAsync(`${this.cliPath} --help`);
				if (stdout.includes('Gemini CLI')) {
					log('debug', 'Gemini CLI detected via help command');
					return true;
				}
			} catch (helpError) {
				log('warn', 'Gemini CLI not found or not available');
			}
			return false;
		}
	}

	/**
	 * Checks if Gemini CLI is properly authenticated
	 * @returns {Promise<boolean>} True if authenticated
	 */
	async isAuthenticated() {
		try {
			// Try a simple test query to check authentication
			const result = await this.executeCli(['--prompt', 'Hello'], { timeout: 10000 });
			return result && result.length > 0;
		} catch (error) {
			if (error.message.includes('authentication') || error.message.includes('API key')) {
				log('warn', 'Gemini CLI authentication required');
				return false;
			}
			// Other errors might not be auth-related
			return true;
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
	 * Executes Gemini CLI command with proper error handling
	 * @param {string[]} args - CLI arguments
	 * @param {object} options - Execution options
	 * @returns {Promise<string>} CLI output
	 */
	async executeCli(args, options = {}) {
		const { timeout = 30000, input = '' } = options;

		return new Promise((resolve, reject) => {
			const child = spawn(this.cliPath, args, {
				stdio: ['pipe', 'pipe', 'pipe'],
				timeout
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
					reject(new Error(`Gemini CLI exited with code ${code}: ${stderr}`));
				}
			});

			child.on('error', (error) => {
				reject(new Error(`Failed to start Gemini CLI: ${error.message}`));
			});

			// Handle timeout
			setTimeout(() => {
				if (!child.killed) {
					child.kill();
					reject(new Error(`Gemini CLI command timed out after ${timeout}ms`));
				}
			}, timeout);

			if (input) {
				child.stdin.write(input);
				child.stdin.end();
			}
		});
	}

	/**
	 * Formats messages for Gemini CLI input
	 * @param {Array} messages - Message array
	 * @returns {string} Formatted prompt
	 */
	formatMessages(messages) {
		return messages
			.map((msg) => {
				const role = msg.role === 'assistant' ? 'Assistant' : 'User';
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
			provider: 'gemini-cli',
			...params
		});
	}

	/**
	 * Generates text using Gemini CLI
	 * @param {object} params - Generation parameters
	 * @returns {Promise<object>} Generation result
	 */
	async generateText(params) {
		try {
			this.validateParams(params);
			this.validateMessages(params.messages);

			if (!(await this.isCliAvailable())) {
				throw new Error('Gemini CLI is not available. Please install and authenticate first.');
			}

			log('debug', `Generating text with Gemini CLI using model: ${params.modelId}`);

			const prompt = this.formatMessages(params.messages);
			const args = ['--prompt', prompt, '--model', params.modelId];

			// Add optional parameters if provided
			if (params.temperature !== undefined) {
				// Gemini CLI might not support temperature directly, but we'll try
				log('debug', `Temperature parameter (${params.temperature}) may not be supported by Gemini CLI`);
			}

			if (params.maxTokens) {
				log('debug', `Max tokens parameter (${params.maxTokens}) may not be supported by Gemini CLI`);
			}

			const result = await this.executeCli(args, { timeout: 60000 });

			log('debug', `Gemini CLI generateText completed successfully`);

			return {
				text: result.trim(),
				usage: {
					inputTokens: null, // Gemini CLI doesn't provide token counts
					outputTokens: null,
					totalTokens: null
				}
			};
		} catch (error) {
			this.handleError('text generation', error);
		}
	}

	/**
	 * Streams text using Gemini CLI
	 * Note: This is a simulation as Gemini CLI doesn't support true streaming
	 * @param {object} params - Stream parameters
	 * @returns {Promise<AsyncIterable>} Stream-like object
	 */
	async streamText(params) {
		try {
			log('warn', 'Gemini CLI does not support true streaming. Falling back to regular generation.');
			
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
						await new Promise(resolve => setTimeout(resolve, 15));
					}
					yield {
						type: 'finish',
						usage: result.usage
					};
				}
			};

			log('debug', 'Gemini CLI streamText simulation completed');
			return stream;
		} catch (error) {
			this.handleError('text streaming', error);
		}
	}

	/**
	 * Generates structured objects using Gemini CLI
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

			log('debug', `Generating object with Gemini CLI using model: ${params.modelId}`);

			// Add schema instructions to the messages
			const schemaPrompt = `Please respond with a valid JSON object that matches this exact schema:
${JSON.stringify(params.schema, null, 2)}

Requirements:
- Response must be valid JSON only
- No explanations, markdown formatting, or additional text
- Follow the schema structure exactly
- Use appropriate data types as specified in the schema`;

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
				// Clean up potential markdown formatting and extra text
				const cleanText = textResult.text
					.replace(/```json\n?/g, '')
					.replace(/```\n?/g, '')
					.replace(/^[^{]*/g, '') // Remove text before first {
					.replace(/[^}]*$/g, '') // Remove text after last }
					.trim();
					
				parsedObject = JSON.parse(cleanText);
			} catch (parseError) {
				throw new Error(`Failed to parse JSON response: ${parseError.message}. Response: ${textResult.text.slice(0, 200)}...`);
			}

			log('debug', `Gemini CLI generateObject completed successfully`);

			return {
				object: parsedObject,
				usage: textResult.usage
			};
		} catch (error) {
			this.handleError('object generation', error);
		}
	}

	/**
	 * Gets available models from Gemini CLI
	 * @returns {Promise<string[]>} Available model names
	 */
	async getAvailableModels() {
		try {
			if (!(await this.isCliAvailable())) {
				return this.supportedModels;
			}

			// Try to get models from CLI help or configuration
			try {
				const { stdout } = await execAsync(`${this.cliPath} --help`);
				// Parse help output for model information
				const modelMatch = stdout.match(/--model\s+[^\n]*\[(.*?)\]/);
				if (modelMatch) {
					const models = modelMatch[1].split('|').map(m => m.trim());
					if (models.length > 0) {
						return models;
					}
				}
			} catch (error) {
				log('debug', 'Could not fetch models from CLI help, using defaults');
			}

			return this.supportedModels;
		} catch (error) {
			log('warn', `Failed to get available models: ${error.message}`);
			return this.supportedModels;
		}
	}

	/**
	 * Health check for the Gemini CLI integration
	 * @returns {Promise<object>} Health status
	 */
	async healthCheck() {
		const isAvailable = await this.isCliAvailable();
		const isAuth = isAvailable ? await this.isAuthenticated() : false;
		const models = await this.getAvailableModels();
		
		return {
			provider: this.name,
			available: isAvailable,
			authenticated: isAuth,
			models,
			requiresApiKey: false,
			maxContextTokens: this._maxContextTokens,
			features: {
				generateText: true,
				streamText: false, // Simulated only
				generateObject: true, // Limited support via prompt engineering
				conversation: true, // Supports conversation context
				multimodal: true, // Gemini supports images and files
				codeGeneration: true, // Strong code generation capabilities
				search: true // Can integrate with Google Search
			},
			limitations: [
				'No true streaming support',
				'Limited structured output control',
				'Token counting not available',
				'Temperature/top-p parameters may not be supported'
			]
		};
	}

	/**
	 * Uploads a file for multimodal interactions
	 * @param {string} filePath - Path to the file
	 * @param {object} params - Additional parameters
	 * @returns {Promise<string>} File reference for use in prompts
	 */
	async uploadFile(filePath, params = {}) {
		try {
			// Gemini CLI supports file upload via @ syntax
			return `@${filePath}`;
		} catch (error) {
			this.handleError('file upload', error);
		}
	}

	/**
	 * Enhanced text generation with file support
	 * @param {object} params - Parameters including optional files
	 * @returns {Promise<object>} Generation result
	 */
	async generateTextWithFiles(params) {
		try {
			const { files = [], ...baseParams } = params;
			
			let enhancedPrompt = this.formatMessages(baseParams.messages);
			
			// Add file references if provided
			if (files.length > 0) {
				const fileRefs = files.map(file => `@${file}`).join(' ');
				enhancedPrompt = `${fileRefs}\n\n${enhancedPrompt}`;
			}

			const args = ['--prompt', enhancedPrompt, '--model', baseParams.modelId];

			const result = await this.executeCli(args, { timeout: 120000 });

			return {
				text: result.trim(),
				usage: {
					inputTokens: null,
					outputTokens: null,
					totalTokens: null
				}
			};
		} catch (error) {
			this.handleError('text generation with files', error);
		}
	}
}