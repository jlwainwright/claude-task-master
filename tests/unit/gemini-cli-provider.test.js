/**
 * tests/unit/gemini-cli-provider.test.js
 * 
 * Unit tests for Google Gemini CLI provider
 */

import {
	jest,
	describe,
	it,
	expect,
	beforeEach,
	afterEach
} from '@jest/globals';

// Mock child_process
const mockExec = jest.fn();
const mockSpawn = jest.fn();
jest.mock('child_process', () => ({
	exec: mockExec,
	spawn: mockSpawn
}));

// Mock util
jest.mock('util', () => ({
	promisify: jest.fn(() => mockExec)
}));

describe('GeminiCLIProvider', () => {
	let provider;
	let GeminiCLIProvider;

	beforeEach(async () => {
		// Dynamic import to avoid circular dependency issues
		const module = await import('../../src/ai-providers/gemini-cli.js');
		GeminiCLIProvider = module.GeminiCLIProvider;
		provider = new GeminiCLIProvider();
		jest.clearAllMocks();
	});

	afterEach(() => {
		jest.resetAllMocks();
	});

	describe('constructor', () => {
		it('should initialize with correct properties', () => {
			expect(provider.name).toBe('GeminiCLI');
			expect(provider.supportedModels).toEqual([
				'gemini-1.5-pro-latest',
				'gemini-1.5-flash',
				'gemini-pro',
				'gemini-1.5-pro',
				'gemini-2.0-flash-exp'
			]);
			expect(provider.cliPath).toBe('gemini');
			expect(provider._sessionCache).toBeInstanceOf(Map);
			expect(provider._maxContextTokens).toBe(1000000);
		});
	});

	describe('validateAuth', () => {
		it('should not require API key validation', () => {
			expect(() => provider.validateAuth({})).not.toThrow();
			expect(() => provider.validateAuth({ apiKey: null })).not.toThrow();
		});
	});

	describe('validateParams', () => {
		it('should validate model ID is provided', () => {
			expect(() => provider.validateParams({})).toThrow('Model ID is required');
		});

		it('should validate supported models', () => {
			expect(() => provider.validateParams({ modelId: 'unsupported' })).toThrow(
				"Model 'unsupported' not supported"
			);
		});

		it('should accept supported models', () => {
			expect(() =>
				provider.validateParams({ modelId: 'gemini-1.5-pro-latest' })
			).not.toThrow();
			expect(() =>
				provider.validateParams({ modelId: 'gemini-1.5-flash' })
			).not.toThrow();
			expect(() =>
				provider.validateParams({ modelId: 'gemini-pro' })
			).not.toThrow();
		});

		it('should validate optional parameters', () => {
			expect(() =>
				provider.validateParams({
					modelId: 'gemini-pro',
					temperature: 1.5
				})
			).toThrow('Temperature must be between 0 and 1');

			expect(() =>
				provider.validateParams({
					modelId: 'gemini-pro',
					maxTokens: -1
				})
			).toThrow('maxTokens must be greater than 0');
		});
	});

	describe('isCliAvailable', () => {
		it('should return true when CLI is available via --version', async () => {
			mockExec.mockResolvedValueOnce({ stdout: 'gemini-cli 1.0.0' });

			const result = await provider.isCliAvailable();
			expect(result).toBe(true);
			expect(mockExec).toHaveBeenCalledWith('gemini --version');
		});

		it('should return true when CLI is available via --help fallback', async () => {
			mockExec.mockRejectedValueOnce(new Error('--version failed'));
			mockExec.mockResolvedValueOnce({ stdout: 'Gemini CLI help information' });

			const result = await provider.isCliAvailable();
			expect(result).toBe(true);
			expect(mockExec).toHaveBeenCalledWith('gemini --help');
		});

		it('should return false when CLI is not available', async () => {
			mockExec.mockRejectedValueOnce(new Error('Command not found'));
			mockExec.mockRejectedValueOnce(new Error('Help also failed'));

			const result = await provider.isCliAvailable();
			expect(result).toBe(false);
		});
	});

	describe('isAuthenticated', () => {
		it('should return true when CLI is authenticated', async () => {
			const mockChild = {
				stdout: { on: jest.fn() },
				stderr: { on: jest.fn() },
				stdin: { write: jest.fn(), end: jest.fn() },
				on: jest.fn(),
				killed: false,
				kill: jest.fn()
			};

			mockSpawn.mockReturnValueOnce(mockChild);

			const promise = provider.isAuthenticated();

			// Simulate successful response
			const stdoutCallback = mockChild.stdout.on.mock.calls.find(
				(call) => call[0] === 'data'
			)[1];
			stdoutCallback('Hello response');

			const closeCallback = mockChild.on.mock.calls.find(
				(call) => call[0] === 'close'
			)[1];
			closeCallback(0);

			const result = await promise;
			expect(result).toBe(true);
		});

		it('should return false when authentication fails', async () => {
			const mockChild = {
				stdout: { on: jest.fn() },
				stderr: { on: jest.fn() },
				stdin: { write: jest.fn(), end: jest.fn() },
				on: jest.fn(),
				killed: false,
				kill: jest.fn()
			};

			mockSpawn.mockReturnValueOnce(mockChild);

			const promise = provider.isAuthenticated();

			// Simulate authentication error
			const stderrCallback = mockChild.stderr.on.mock.calls.find(
				(call) => call[0] === 'data'
			)[1];
			stderrCallback('authentication error');

			const closeCallback = mockChild.on.mock.calls.find(
				(call) => call[0] === 'close'
			)[1];
			closeCallback(1);

			const result = await promise;
			expect(result).toBe(false);
		});
	});

	describe('createSessionId', () => {
		it('should create consistent session IDs for same params', () => {
			const params = { modelId: 'gemini-pro', temperature: 0.7, maxTokens: 1000 };
			const id1 = provider.createSessionId(params);
			const id2 = provider.createSessionId(params);

			expect(id1).toBe(id2);
			expect(typeof id1).toBe('string');
			expect(id1.length).toBe(16);
		});

		it('should create different session IDs for different params', () => {
			const params1 = { modelId: 'gemini-pro', temperature: 0.7 };
			const params2 = { modelId: 'gemini-1.5-flash', temperature: 0.7 };

			const id1 = provider.createSessionId(params1);
			const id2 = provider.createSessionId(params2);

			expect(id1).not.toBe(id2);
		});
	});

	describe('formatMessages', () => {
		it('should format messages correctly', () => {
			const messages = [
				{ role: 'user', content: 'Hello' },
				{ role: 'assistant', content: 'Hi there!' },
				{ role: 'user', content: 'How are you?' }
			];

			const formatted = provider.formatMessages(messages);
			const expected =
				'User: Hello\n\nAssistant: Hi there!\n\nUser: How are you?';

			expect(formatted).toBe(expected);
		});

		it('should handle empty messages', () => {
			const formatted = provider.formatMessages([]);
			expect(formatted).toBe('');
		});
	});

	describe('executeCli', () => {
		it('should execute CLI command successfully', async () => {
			const mockChild = {
				stdout: { on: jest.fn() },
				stderr: { on: jest.fn() },
				stdin: { write: jest.fn(), end: jest.fn() },
				on: jest.fn(),
				killed: false,
				kill: jest.fn()
			};

			mockSpawn.mockReturnValueOnce(mockChild);

			// Simulate successful execution
			const promise = provider.executeCli(['--model', 'gemini-pro'], {
				input: 'test input'
			});

			// Simulate stdout data
			const stdoutCallback = mockChild.stdout.on.mock.calls.find(
				(call) => call[0] === 'data'
			)[1];
			stdoutCallback('Test output');

			// Simulate successful close
			const closeCallback = mockChild.on.mock.calls.find(
				(call) => call[0] === 'close'
			)[1];
			closeCallback(0);

			const result = await promise;
			expect(result).toBe('Test output');
			expect(mockChild.stdin.write).toHaveBeenCalledWith('test input');
			expect(mockChild.stdin.end).toHaveBeenCalled();
		});

		it('should handle CLI execution errors', async () => {
			const mockChild = {
				stdout: { on: jest.fn() },
				stderr: { on: jest.fn() },
				stdin: { write: jest.fn(), end: jest.fn() },
				on: jest.fn(),
				killed: false,
				kill: jest.fn()
			};

			mockSpawn.mockReturnValueOnce(mockChild);

			const promise = provider.executeCli(['--model', 'gemini-pro']);

			// Simulate error
			const errorCallback = mockChild.on.mock.calls.find(
				(call) => call[0] === 'error'
			)[1];
			errorCallback(new Error('Spawn failed'));

			await expect(promise).rejects.toThrow('Failed to start Gemini CLI');
		});

		it('should handle timeout', async () => {
			const mockChild = {
				stdout: { on: jest.fn() },
				stderr: { on: jest.fn() },
				stdin: { write: jest.fn(), end: jest.fn() },
				on: jest.fn(),
				killed: false,
				kill: jest.fn()
			};

			mockSpawn.mockReturnValueOnce(mockChild);

			const promise = provider.executeCli(['--model', 'gemini-pro'], {
				timeout: 100
			});

			// Don't simulate any response, let it timeout
			setTimeout(() => {
				mockChild.killed = true;
			}, 150);

			await expect(promise).rejects.toThrow('timed out after 100ms');
		});
	});

	describe('getClient', () => {
		it('should return mock client function', () => {
			const params = { modelId: 'gemini-pro' };
			const client = provider.getClient(params);

			expect(typeof client).toBe('function');

			const result = client('test-model');
			expect(result).toEqual({
				modelId: 'test-model',
				provider: 'gemini-cli',
				...params
			});
		});
	});

	describe('getAvailableModels', () => {
		it('should return supported models when CLI is not available', async () => {
			mockExec.mockRejectedValueOnce(new Error('CLI not found'));
			mockExec.mockRejectedValueOnce(new Error('Help also failed'));

			const models = await provider.getAvailableModels();
			expect(models).toEqual([
				'gemini-1.5-pro-latest',
				'gemini-1.5-flash',
				'gemini-pro',
				'gemini-1.5-pro',
				'gemini-2.0-flash-exp'
			]);
		});

		it('should parse models from CLI help when available', async () => {
			mockExec.mockResolvedValueOnce({ stdout: 'gemini-cli 1.0.0' });
			mockExec.mockResolvedValueOnce({
				stdout: '--model [gemini-pro|gemini-1.5-flash|gemini-1.5-pro] Select model'
			});

			const models = await provider.getAvailableModels();
			expect(models).toEqual(['gemini-pro', 'gemini-1.5-flash', 'gemini-1.5-pro']);
		});

		it('should return supported models when CLI help parsing fails', async () => {
			mockExec.mockResolvedValueOnce({ stdout: 'gemini-cli 1.0.0' });
			mockExec.mockResolvedValueOnce({
				stdout: 'Generic help without model info'
			});

			const models = await provider.getAvailableModels();
			expect(models).toEqual([
				'gemini-1.5-pro-latest',
				'gemini-1.5-flash',
				'gemini-pro',
				'gemini-1.5-pro',
				'gemini-2.0-flash-exp'
			]);
		});
	});

	describe('healthCheck', () => {
		it('should return comprehensive health status when available and authenticated', async () => {
			// Mock CLI availability
			mockExec.mockResolvedValueOnce({ stdout: 'gemini-cli 1.0.0' });

			// Mock authentication check
			const mockChild = {
				stdout: { on: jest.fn() },
				stderr: { on: jest.fn() },
				stdin: { write: jest.fn(), end: jest.fn() },
				on: jest.fn(),
				killed: false,
				kill: jest.fn()
			};

			mockSpawn.mockReturnValueOnce(mockChild);

			const authPromise = provider.isAuthenticated();

			// Simulate successful auth response
			const stdoutCallback = mockChild.stdout.on.mock.calls.find(
				(call) => call[0] === 'data'
			)[1];
			stdoutCallback('Hello response');

			const closeCallback = mockChild.on.mock.calls.find(
				(call) => call[0] === 'close'
			)[1];
			closeCallback(0);

			await authPromise;

			const health = await provider.healthCheck();

			expect(health).toEqual({
				provider: 'GeminiCLI',
				available: true,
				authenticated: true,
				models: [
					'gemini-1.5-pro-latest',
					'gemini-1.5-flash',
					'gemini-pro',
					'gemini-1.5-pro',
					'gemini-2.0-flash-exp'
				],
				requiresApiKey: false,
				maxContextTokens: 1000000,
				features: {
					generateText: true,
					streamText: false,
					generateObject: true,
					conversation: true,
					multimodal: true,
					codeGeneration: true,
					search: true
				},
				limitations: [
					'No true streaming support',
					'Limited structured output control',
					'Token counting not available',
					'Temperature/top-p parameters may not be supported'
				]
			});
		});
	});

	describe('generateText', () => {
		it('should validate parameters before execution', async () => {
			const params = {
				messages: [{ role: 'user', content: 'Hello' }]
			};

			await expect(provider.generateText(params)).rejects.toThrow(
				'Model ID is required'
			);
		});

		it('should check CLI availability', async () => {
			const params = {
				modelId: 'gemini-pro',
				messages: [{ role: 'user', content: 'Hello' }]
			};

			mockExec.mockRejectedValueOnce(new Error('CLI not found'));
			mockExec.mockRejectedValueOnce(new Error('Help also failed'));

			await expect(provider.generateText(params)).rejects.toThrow(
				'Gemini CLI is not available'
			);
		});

		it('should generate text successfully', async () => {
			const params = {
				modelId: 'gemini-pro',
				messages: [{ role: 'user', content: 'Hello' }]
			};

			// Mock CLI availability
			mockExec.mockResolvedValueOnce({ stdout: 'gemini-cli 1.0.0' });

			// Mock successful text generation
			const mockChild = {
				stdout: { on: jest.fn() },
				stderr: { on: jest.fn() },
				stdin: { write: jest.fn(), end: jest.fn() },
				on: jest.fn(),
				killed: false,
				kill: jest.fn()
			};

			mockSpawn.mockReturnValueOnce(mockChild);

			const promise = provider.generateText(params);

			// Simulate response
			const stdoutCallback = mockChild.stdout.on.mock.calls.find(
				(call) => call[0] === 'data'
			)[1];
			stdoutCallback('Generated response text');

			const closeCallback = mockChild.on.mock.calls.find(
				(call) => call[0] === 'close'
			)[1];
			closeCallback(0);

			const result = await promise;

			expect(result).toEqual({
				text: 'Generated response text',
				usage: {
					inputTokens: null,
					outputTokens: null,
					totalTokens: null
				}
			});
		});
	});

	describe('generateObject', () => {
		it('should require schema parameter', async () => {
			const params = {
				modelId: 'gemini-pro',
				messages: [{ role: 'user', content: 'Hello' }]
			};

			await expect(provider.generateObject(params)).rejects.toThrow(
				'Schema is required'
			);
		});

		it('should handle JSON parsing errors', async () => {
			const params = {
				modelId: 'gemini-pro',
				messages: [{ role: 'user', content: 'Hello' }],
				schema: { type: 'object', properties: {} }
			};

			// Mock CLI availability
			mockExec.mockResolvedValueOnce({ stdout: 'gemini-cli 1.0.0' });

			// Mock successful CLI execution but invalid JSON
			const mockChild = {
				stdout: { on: jest.fn() },
				stderr: { on: jest.fn() },
				stdin: { write: jest.fn(), end: jest.fn() },
				on: jest.fn(),
				killed: false,
				kill: jest.fn()
			};

			mockSpawn.mockReturnValueOnce(mockChild);

			const promise = provider.generateObject(params);

			// Simulate invalid JSON output
			const stdoutCallback = mockChild.stdout.on.mock.calls.find(
				(call) => call[0] === 'data'
			)[1];
			stdoutCallback('Invalid JSON response');

			const closeCallback = mockChild.on.mock.calls.find(
				(call) => call[0] === 'close'
			)[1];
			closeCallback(0);

			await expect(promise).rejects.toThrow('Failed to parse JSON response');
		});

		it('should generate valid JSON object', async () => {
			const params = {
				modelId: 'gemini-pro',
				messages: [{ role: 'user', content: 'Create a user object' }],
				schema: {
					type: 'object',
					properties: {
						name: { type: 'string' },
						age: { type: 'number' }
					}
				}
			};

			// Mock CLI availability
			mockExec.mockResolvedValueOnce({ stdout: 'gemini-cli 1.0.0' });

			// Mock successful CLI execution with valid JSON
			const mockChild = {
				stdout: { on: jest.fn() },
				stderr: { on: jest.fn() },
				stdin: { write: jest.fn(), end: jest.fn() },
				on: jest.fn(),
				killed: false,
				kill: jest.fn()
			};

			mockSpawn.mockReturnValueOnce(mockChild);

			const promise = provider.generateObject(params);

			// Simulate valid JSON output
			const stdoutCallback = mockChild.stdout.on.mock.calls.find(
				(call) => call[0] === 'data'
			)[1];
			stdoutCallback('{"name": "John Doe", "age": 30}');

			const closeCallback = mockChild.on.mock.calls.find(
				(call) => call[0] === 'close'
			)[1];
			closeCallback(0);

			const result = await promise;

			expect(result).toEqual({
				object: { name: 'John Doe', age: 30 },
				usage: {
					inputTokens: null,
					outputTokens: null,
					totalTokens: null
				}
			});
		});
	});

	describe('uploadFile', () => {
		it('should return file reference for multimodal use', async () => {
			const filePath = '/path/to/image.jpg';
			const result = await provider.uploadFile(filePath);
			expect(result).toBe('@/path/to/image.jpg');
		});
	});

	describe('generateTextWithFiles', () => {
		it('should include file references in prompt', async () => {
			const params = {
				modelId: 'gemini-pro',
				messages: [{ role: 'user', content: 'Analyze this image' }],
				files: ['/path/to/image.jpg', '/path/to/document.pdf']
			};

			// Mock CLI availability
			mockExec.mockResolvedValueOnce({ stdout: 'gemini-cli 1.0.0' });

			// Mock successful execution
			const mockChild = {
				stdout: { on: jest.fn() },
				stderr: { on: jest.fn() },
				stdin: { write: jest.fn(), end: jest.fn() },
				on: jest.fn(),
				killed: false,
				kill: jest.fn()
			};

			mockSpawn.mockReturnValueOnce(mockChild);

			const promise = provider.generateTextWithFiles(params);

			// Simulate response
			const stdoutCallback = mockChild.stdout.on.mock.calls.find(
				(call) => call[0] === 'data'
			)[1];
			stdoutCallback('Analysis of the provided files');

			const closeCallback = mockChild.on.mock.calls.find(
				(call) => call[0] === 'close'
			)[1];
			closeCallback(0);

			const result = await promise;

			expect(result).toEqual({
				text: 'Analysis of the provided files',
				usage: {
					inputTokens: null,
					outputTokens: null,
					totalTokens: null
				}
			});

			// Check that files were included in the command
			expect(mockSpawn).toHaveBeenCalledWith(
				'gemini',
				expect.arrayContaining([
					'--prompt',
					expect.stringContaining('@/path/to/image.jpg @/path/to/document.pdf')
				]),
				expect.any(Object)
			);
		});
	});
});