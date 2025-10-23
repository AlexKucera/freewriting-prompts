// ABOUTME: Anthropic API client for generating writing prompts using Claude
// ABOUTME: Handles API requests, error handling, and response parsing

import { requestUrl } from 'obsidian';
import { AnthropicRequest, AnthropicResponse, ModelsListResponse } from '../types';

export class AnthropicClient {
    private apiKey: string;
    private messagesUrl = 'https://api.anthropic.com/v1/messages';
    private modelsUrl = 'https://api.anthropic.com/v1/models';
    private readonly SYSTEM_PROMPT_SUFFIX = '\n\nIMPORTANT OUTPUT REQUIREMENTS:\n- Return ONLY the numbered writing prompts, nothing else\n- Do not include any explanations, questions, or additional commentary\n- Do not ask if the user wants more prompts or different styles\n- Format: numbered list with one prompt per line (1. [prompt], 2. [prompt], etc.)';

    private readonly TIMED_PROMPT_MODIFIER = '\n\nFOR TIMED PROMPTS - MAKE THEM EXTREMELY SHORT AND DIRECT:\n- Each prompt should be answerable in 1-5 words or a single sentence\n- Focus on immediate, concrete observations or quick thoughts\n- Avoid complex scenarios or deep philosophical questions\n- Examples: "What color is closest to you?", "Your favorite word today:", "First sound you hear:", "Describe your mood in one word", "Name something soft"\n- Keep prompts simple, immediate, and concrete';

    constructor(apiKey: string) {
        this.apiKey = apiKey;
    }

    // MARK: - Public Methods

    async generatePrompts(
        count: number,
        model: string,
        systemPrompt: string,
        examplePrompt: string,
        type: 'timed' | 'note'
    ): Promise<string[]> {
        if (!this.apiKey) {
            throw new Error('API key is required');
        }

        try {
            const userMessage = this.createUserMessage(count, examplePrompt);

            // Build system prompt with type-specific modifiers
            let finalSystemPrompt = systemPrompt;
            if (type === 'timed') {
                finalSystemPrompt += this.TIMED_PROMPT_MODIFIER;
            }
            finalSystemPrompt += this.SYSTEM_PROMPT_SUFFIX;

            const request: AnthropicRequest = {
                model,
                max_tokens: 1000,
                messages: [{ role: 'user', content: userMessage }],
                system: finalSystemPrompt
            };

            const response = await this.makeRequest(request);
            return this.parsePromptsFromResponse(response);
        } catch (error) {
            console.error('Error generating prompts:', error);
            if (error instanceof Error) {
                throw error;
            }
            throw new Error('Unknown error occurred while generating prompts');
        }
    }

    async fetchModels(): Promise<ModelsListResponse> {
        if (!this.apiKey) {
            throw new Error('API key is required');
        }

        try {
            const response = await requestUrl({
                url: this.modelsUrl,
                method: 'GET',
                headers: {
                    'x-api-key': this.apiKey,
                    'anthropic-version': '2023-06-01'
                }
            });

            if (response.status < 200 || response.status >= 300) {
                throw new Error(`Models API request failed: ${response.status}\n${response.text}`);
            }

            return response.json as ModelsListResponse;
        } catch (error) {
            if (error instanceof Error) {
                throw error;
            }
            throw new Error(`Network request failed: ${String(error)}`);
        }
    }

    // MARK: - Private Methods

    private createUserMessage(count: number, examplePrompt: string): string {
        const baseMessage = `Generate exactly ${count} creative writing prompts. Return ONLY the numbered prompts with no additional text or commentary.`;

        if (examplePrompt.trim()) {
            return `${baseMessage}\n\nExample style: "${examplePrompt}"\n\nProvide ${count} similar prompts in this exact format:\n1. [prompt]\n2. [prompt]\n(etc.)`;
        }

        return `${baseMessage}\n\nProvide ${count} diverse writing prompts in this exact format:\n1. [prompt]\n2. [prompt]\n(etc.)`;
    }

    private async makeRequest(request: AnthropicRequest): Promise<AnthropicResponse> {
        try {
            const response = await requestUrl({
                url: this.messagesUrl,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': this.apiKey,
                    'anthropic-version': '2023-06-01'
                },
                body: JSON.stringify(request)
            });

            if (response.status < 200 || response.status >= 300) {
                throw new Error(`API request failed: ${response.status}\n${response.text}`);
            }

            return response.json as AnthropicResponse;
        } catch (error) {
            if (error instanceof Error) {
                throw error;
            }
            throw new Error(`Network request failed: ${String(error)}`);
        }
    }

    private parsePromptsFromResponse(response: AnthropicResponse): string[] {
        if (!response.content || response.content.length === 0) {
            throw new Error('No content received from API');
        }

        const text = response.content[0].text;
        const lines = text.split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0);

        const prompts: string[] = [];

        for (const line of lines) {
            // Remove numbering (1., 2., etc.) and clean up the prompt
            const cleaned = line.replace(/^\d+\.\s*/, '').trim();
            if (cleaned.length > 0) {
                prompts.push(cleaned);
            }
        }

        if (prompts.length === 0) {
            throw new Error('No valid prompts found in API response');
        }

        return prompts;
    }

    // MARK: - Configuration Methods

    updateApiKey(apiKey: string): void {
        this.apiKey = apiKey;
    }

    validateApiKey(): boolean {
        return !!(this.apiKey && this.apiKey.trim().length > 0);
    }

    async testApiKey(model: string): Promise<{
        success: boolean;
        message: string;
        details?: {
            model?: string;
            responseTime: number;
            inputTokens?: number;
            outputTokens?: number;
        };
        error?: string;
    }> {
        if (!this.validateApiKey()) {
            return {
                success: false,
                message: 'API key is empty or invalid format',
                error: 'INVALID_KEY_FORMAT'
            };
        }

        const startTime = Date.now();

        try {
            const testRequest: AnthropicRequest = {
                model,
                max_tokens: 10,
                messages: [{ role: 'user', content: 'Please respond with just the word "ping"' }],
                system: 'You are a test assistant. Respond only with the exact word requested.'
            };

            const response = await this.makeRequest(testRequest);
            const responseTime = Date.now() - startTime;

            return {
                success: true,
                message: 'API key is valid and working correctly',
                details: {
                    model: response.model,
                    responseTime,
                    inputTokens: response.usage?.input_tokens,
                    outputTokens: response.usage?.output_tokens
                }
            };

        } catch (error) {
            const responseTime = Date.now() - startTime;
            return this.parseTestError(error, responseTime);
        }
    }

    private parseTestError(error: unknown, responseTime: number): {
        success: boolean;
        message: string;
        details?: {
            model?: string;
            responseTime: number;
            inputTokens?: number;
            outputTokens?: number;
        };
        error: string;
    } {
        const baseResult = {
            success: false,
            details: { responseTime }
        };

        if (error instanceof Error) {
            const errorMessage = error.message.toLowerCase();

            // Check for specific error types
            if (errorMessage.includes('401') || errorMessage.includes('unauthorized')) {
                return {
                    ...baseResult,
                    message: 'API key is invalid or unauthorized',
                    error: 'UNAUTHORIZED'
                };
            }

            if (errorMessage.includes('429') || errorMessage.includes('rate limit')) {
                return {
                    ...baseResult,
                    message: 'Rate limit exceeded. Please try again later.',
                    error: 'RATE_LIMITED'
                };
            }

            if (errorMessage.includes('403') || errorMessage.includes('forbidden')) {
                return {
                    ...baseResult,
                    message: 'API access forbidden. Check your account status and billing.',
                    error: 'FORBIDDEN'
                };
            }

            if (errorMessage.includes('400') || errorMessage.includes('bad request')) {
                return {
                    ...baseResult,
                    message: 'Invalid request format. This may indicate a plugin bug.',
                    error: 'BAD_REQUEST'
                };
            }

            if (errorMessage.includes('500') || errorMessage.includes('internal server')) {
                return {
                    ...baseResult,
                    message: 'Anthropic server error. Please try again later.',
                    error: 'SERVER_ERROR'
                };
            }

            if (errorMessage.includes('network') || errorMessage.includes('fetch')) {
                return {
                    ...baseResult,
                    message: 'Network error. Check your internet connection.',
                    error: 'NETWORK_ERROR'
                };
            }

            // Generic error with the actual message
            return {
                ...baseResult,
                message: `API test failed: ${error.message}`,
                error: 'UNKNOWN_ERROR'
            };
        }

        return {
            ...baseResult,
            message: 'Unknown error occurred during API test',
            error: 'UNKNOWN_ERROR'
        };
    }
}