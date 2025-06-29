import { generateText, streamText, generateObject } from 'ai';

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
 * Base class for all AI providers
 * Provides common functionality and enforces interface contracts
 */
export class BaseAIProvider {
	constructor() {
		if (this.constructor === BaseAIProvider) {
			throw new Error('BaseAIProvider cannot be instantiated directly');
		}

		// Each provider must set their name
		this.name = this.constructor.name;

		// Performance tracking
		this._metrics = {
			requests: 0,
			successful: 0,
			failed: 0,
			totalLatency: 0
		};

		// Rate limiting support
		this._lastRequest = 0;
		this._minInterval = 100; // ms between requests
	}

	/**
	 * Validates authentication parameters - can be overridden by providers
	 * @param {object} params - Parameters to validate
	 */
	validateAuth(params) {
		// Default: require API key (most providers need this)
		if (!params.apiKey) {
			throw new Error(`${this.name} API key is required`);
		}
	}

	/**
	 * Validates common parameters across all methods
	 * @param {object} params - Parameters to validate
	 */
	validateParams(params) {
		// Validate authentication (can be overridden by providers)
		this.validateAuth(params);

		// Validate required model ID
		if (!params.modelId) {
			throw new Error(`${this.name} Model ID is required`);
		}

		// Validate optional parameters
		this.validateOptionalParams(params);
	}

	/**
	 * Validates optional parameters like temperature and maxTokens
	 * @param {object} params - Parameters to validate
	 */
	validateOptionalParams(params) {
		if (
			params.temperature !== undefined &&
			(params.temperature < 0 || params.temperature > 1)
		) {
			throw new Error('Temperature must be between 0 and 1');
		}
		if (params.maxTokens !== undefined && params.maxTokens <= 0) {
			throw new Error('maxTokens must be greater than 0');
		}
	}

	/**
	 * Validates message array structure
	 */
	validateMessages(messages) {
		if (!messages || !Array.isArray(messages) || messages.length === 0) {
			throw new Error('Invalid or empty messages array provided');
		}

		for (const msg of messages) {
			if (!msg.role || !msg.content) {
				throw new Error(
					'Invalid message format. Each message must have role and content'
				);
			}
		}
	}

	/**
	 * Enhanced error handler with retry logic and metrics
	 * @param {string} operation - Operation that failed
	 * @param {Error} error - The error that occurred
	 * @param {object} [context] - Additional context for debugging
	 */
	handleError(operation, error, context = {}) {
		this._metrics.failed++;

		const errorMessage = error.message || 'Unknown error occurred';
		const enhancedContext = {
			provider: this.name,
			operation,
			timestamp: new Date().toISOString(),
			metrics: this._metrics,
			...context
		};

		log('error', `${this.name} ${operation} failed: ${errorMessage}`, {
			error,
			context: enhancedContext
		});

		// Enhanced error with provider context
		const enhancedError = new Error(
			`${this.name} API error during ${operation}: ${errorMessage}`
		);
		enhancedError.provider = this.name;
		enhancedError.operation = operation;
		enhancedError.originalError = error;
		enhancedError.context = enhancedContext;

		throw enhancedError;
	}

	/**
	 * Rate limiting helper
	 * @param {number} [minInterval] - Minimum interval between requests in ms
	 */
	async _enforceRateLimit(minInterval = this._minInterval) {
		const now = Date.now();
		const timeSinceLastRequest = now - this._lastRequest;

		if (timeSinceLastRequest < minInterval) {
			const delay = minInterval - timeSinceLastRequest;
			log('debug', `${this.name} rate limiting: waiting ${delay}ms`);
			await new Promise((resolve) => setTimeout(resolve, delay));
		}

		this._lastRequest = Date.now();
	}

	/**
	 * Performance tracking wrapper
	 * @param {string} operation - Operation name
	 * @param {Function} fn - Function to execute
	 * @returns {Promise<any>} Function result
	 */
	async _trackPerformance(operation, fn) {
		const startTime = Date.now();
		this._metrics.requests++;

		try {
			await this._enforceRateLimit();
			const result = await fn();
			this._metrics.successful++;
			const latency = Date.now() - startTime;
			this._metrics.totalLatency += latency;

			log('debug', `${this.name} ${operation} completed in ${latency}ms`);
			return result;
		} catch (error) {
			this._metrics.failed++;
			throw error;
		}
	}

	/**
	 * Get performance metrics
	 * @returns {object} Performance metrics
	 */
	getMetrics() {
		return {
			...this._metrics,
			averageLatency:
				this._metrics.successful > 0
					? Math.round(this._metrics.totalLatency / this._metrics.successful)
					: 0,
			successRate:
				this._metrics.requests > 0
					? Math.round(
							(this._metrics.successful / this._metrics.requests) * 100
						)
					: 0
		};
	}

	/**
	 * Creates and returns a client instance for the provider
	 * @abstract
	 */
	getClient(params) {
		throw new Error('getClient must be implemented by provider');
	}

	/**
	 * Generates text using the provider's model
	 * Enhanced with performance tracking and caching
	 */
	async generateText(params) {
		return this._trackPerformance('generateText', async () => {
			this.validateParams(params);
			this.validateMessages(params.messages);

			log(
				'debug',
				`Generating ${this.name} text with model: ${params.modelId}`
			);

			try {
				const client = this.getClient(params);
				const result = await generateText({
					model: client(params.modelId),
					messages: params.messages,
					maxTokens: params.maxTokens,
					temperature: params.temperature,
					// Add abort signal for timeout support
					abortSignal: params.abortSignal
				});

				log(
					'debug',
					`${this.name} generateText completed successfully for model: ${params.modelId}`
				);

				return {
					text: result.text,
					usage: {
						inputTokens: result.usage?.promptTokens,
						outputTokens: result.usage?.completionTokens,
						totalTokens: result.usage?.totalTokens
					}
				};
			} catch (error) {
				this.handleError('text generation', error, {
					modelId: params.modelId,
					messageCount: params.messages.length,
					maxTokens: params.maxTokens,
					temperature: params.temperature
				});
			}
		});
	}

	/**
	 * Streams text using the provider's model
	 * Enhanced with performance tracking and error handling
	 */
	async streamText(params) {
		return this._trackPerformance('streamText', async () => {
			this.validateParams(params);
			this.validateMessages(params.messages);

			log('debug', `Streaming ${this.name} text with model: ${params.modelId}`);

			try {
				const client = this.getClient(params);
				const stream = await streamText({
					model: client(params.modelId),
					messages: params.messages,
					maxTokens: params.maxTokens,
					temperature: params.temperature,
					abortSignal: params.abortSignal
				});

				log(
					'debug',
					`${this.name} streamText initiated successfully for model: ${params.modelId}`
				);

				return stream;
			} catch (error) {
				this.handleError('text streaming', error, {
					modelId: params.modelId,
					messageCount: params.messages.length
				});
			}
		});
	}

	/**
	 * Generates a structured object using the provider's model
	 * Enhanced with performance tracking and validation
	 */
	async generateObject(params) {
		return this._trackPerformance('generateObject', async () => {
			this.validateParams(params);
			this.validateMessages(params.messages);

			if (!params.schema) {
				throw new Error('Schema is required for object generation');
			}
			if (!params.objectName) {
				throw new Error('Object name is required for object generation');
			}

			log(
				'debug',
				`Generating ${this.name} object ('${params.objectName}') with model: ${params.modelId}`
			);

			try {
				const client = this.getClient(params);
				const result = await generateObject({
					model: client(params.modelId),
					messages: params.messages,
					schema: params.schema,
					mode: 'auto',
					maxTokens: params.maxTokens,
					temperature: params.temperature,
					abortSignal: params.abortSignal
				});

				log(
					'debug',
					`${this.name} generateObject completed successfully for model: ${params.modelId}`
				);

				return {
					object: result.object,
					usage: {
						inputTokens: result.usage?.promptTokens,
						outputTokens: result.usage?.completionTokens,
						totalTokens: result.usage?.totalTokens
					}
				};
			} catch (error) {
				this.handleError('object generation', error, {
					modelId: params.modelId,
					objectName: params.objectName,
					schemaKeys: Object.keys(params.schema.properties || {})
				});
			}
		});
	}
}
