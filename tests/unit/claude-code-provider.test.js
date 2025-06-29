/**
 * tests/unit/claude-code-provider.test.js
 *
 * Unit tests for Claude Code CLI provider
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

describe('ClaudeCodeProvider', () => {
	let provider;
	let ClaudeCodeProvider;

	beforeEach(async () => {
		// Dynamic import to avoid circular dependency issues
		const module = await import('../../src/ai-providers/claude-code.js');
		ClaudeCodeProvider = module.ClaudeCodeProvider;
		provider = new ClaudeCodeProvider();
		jest.clearAllMocks();
	});

	afterEach(() => {
		jest.resetAllMocks();
	});

	describe('constructor', () => {
		it('should initialize with correct properties', () => {
			expect(provider.name).toBe('ClaudeCode');
			expect(provider.supportedModels).toEqual(['opus', 'sonnet']);
			expect(provider.cliPath).toBe('claude');
			expect(provider._sessionCache).toBeInstanceOf(Map);
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
			expect(() => provider.validateParams({ modelId: 'opus' })).not.toThrow();
			expect(() =>
				provider.validateParams({ modelId: 'sonnet' })
			).not.toThrow();
		});

		it('should validate optional parameters', () => {
			expect(() =>
				provider.validateParams({
					modelId: 'opus',
					temperature: 1.5
				})
			).toThrow('Temperature must be between 0 and 1');

			expect(() =>
				provider.validateParams({
					modelId: 'opus',
					maxTokens: -1
				})
			).toThrow('maxTokens must be greater than 0');
		});
	});

	describe('isCliAvailable', () => {
		it('should return true when CLI is available', async () => {
			mockExec.mockResolvedValueOnce({ stdout: 'claude-code 1.0.0' });

			const result = await provider.isCliAvailable();
			expect(result).toBe(true);
			expect(mockExec).toHaveBeenCalledWith('claude --version');
		});

		it('should return false when CLI is not available', async () => {
			mockExec.mockRejectedValueOnce(new Error('Command not found'));

			const result = await provider.isCliAvailable();
			expect(result).toBe(false);
		});
	});

	describe('createSessionId', () => {
		it('should create consistent session IDs for same params', () => {
			const params = { modelId: 'opus', temperature: 0.7, maxTokens: 1000 };
			const id1 = provider.createSessionId(params);
			const id2 = provider.createSessionId(params);

			expect(id1).toBe(id2);
			expect(typeof id1).toBe('string');
			expect(id1.length).toBe(16);
		});

		it('should create different session IDs for different params', () => {
			const params1 = { modelId: 'opus', temperature: 0.7 };
			const params2 = { modelId: 'sonnet', temperature: 0.7 };

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
				'Human: Hello\\n\\nClaude: Hi there!\\n\\nHuman: How are you?';

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
				on: jest.fn()
			};

			mockSpawn.mockReturnValueOnce(mockChild);

			// Simulate successful execution
			const promise = provider.executeCli(['--model', 'opus'], 'test input');

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
				on: jest.fn()
			};

			mockSpawn.mockReturnValueOnce(mockChild);

			const promise = provider.executeCli(['--model', 'opus']);

			// Simulate error
			const errorCallback = mockChild.on.mock.calls.find(
				(call) => call[0] === 'error'
			)[1];
			errorCallback(new Error('Spawn failed'));

			await expect(promise).rejects.toThrow('Failed to start Claude CLI');
		});
	});

	describe('getClient', () => {
		it('should return mock client function', () => {
			const params = { modelId: 'opus' };
			const client = provider.getClient(params);

			expect(typeof client).toBe('function');

			const result = client('test-model');
			expect(result).toEqual({
				modelId: 'test-model',
				provider: 'claude-code',
				...params
			});
		});
	});

	describe('getAvailableModels', () => {
		it('should return supported models when CLI is not available', async () => {
			mockExec.mockRejectedValueOnce(new Error('CLI not found'));

			const models = await provider.getAvailableModels();
			expect(models).toEqual(['opus', 'sonnet']);
		});

		it('should return supported models when CLI help parsing fails', async () => {
			mockExec.mockResolvedValueOnce({ stdout: 'claude-code 1.0.0' });
			mockExec.mockResolvedValueOnce({
				stdout: 'Generic help without model info'
			});

			const models = await provider.getAvailableModels();
			expect(models).toEqual(['opus', 'sonnet']);
		});
	});

	describe('healthCheck', () => {
		it('should return comprehensive health status', async () => {
			mockExec.mockResolvedValueOnce({ stdout: 'claude-code 1.0.0' });

			const health = await provider.healthCheck();

			expect(health).toEqual({
				provider: 'ClaudeCode',
				available: true,
				models: ['opus', 'sonnet'],
				requiresApiKey: false,
				features: {
					generateText: true,
					streamText: false,
					generateObject: true,
					conversation: false
				}
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
				modelId: 'opus',
				messages: [{ role: 'user', content: 'Hello' }]
			};

			mockExec.mockRejectedValueOnce(new Error('CLI not found'));

			await expect(provider.generateText(params)).rejects.toThrow(
				'Claude Code CLI is not available'
			);
		});
	});

	describe('generateObject', () => {
		it('should require schema parameter', async () => {
			const params = {
				modelId: 'opus',
				messages: [{ role: 'user', content: 'Hello' }]
			};

			await expect(provider.generateObject(params)).rejects.toThrow(
				'Schema is required'
			);
		});

		it('should handle JSON parsing errors', async () => {
			const params = {
				modelId: 'opus',
				messages: [{ role: 'user', content: 'Hello' }],
				schema: { type: 'object', properties: {} }
			};

			mockExec.mockResolvedValueOnce({ stdout: 'claude-code 1.0.0' });

			// Mock successful CLI execution but invalid JSON
			const mockChild = {
				stdout: { on: jest.fn() },
				stderr: { on: jest.fn() },
				stdin: { write: jest.fn(), end: jest.fn() },
				on: jest.fn()
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
	});
});
