// ABOUTME: Anthropic API client for generating writing prompts using Claude
// ABOUTME: Handles API requests, error handling, and response parsing

import { Notice, requestUrl } from 'obsidian';
import { AnthropicRequest, AnthropicResponse, AnthropicModel } from '../types';

export class AnthropicClient {
    private apiKey: string;
    private baseUrl = 'https://api.anthropic.com/v1/messages';

    constructor(apiKey: string) {
        this.apiKey = apiKey;
    }

    // MARK: - Public Methods

    async generatePrompts(
        count: number,
        model: AnthropicModel,
        systemPrompt: string,
        examplePrompt: string
    ): Promise<string[]> {
        if (!this.apiKey) {
            throw new Error('API key is required');
        }

        try {
            const userMessage = this.createUserMessage(count, examplePrompt);
            const request: AnthropicRequest = {
                model,
                max_tokens: 1000,
                messages: [{ role: 'user', content: userMessage }],
                system: systemPrompt
            };

            const response = await this.makeRequest(request);
            return this.parsePromptsFromResponse(response);
        } catch (error) {
            console.error('Error generating prompts:', error);
            if (error instanceof Error) {
                new Notice(`Failed to generate prompts: ${error.message}`);
                throw error;
            }
            throw new Error('Unknown error occurred while generating prompts');
        }
    }

    // MARK: - Private Methods

    private createUserMessage(count: number, examplePrompt: string): string {
        const baseMessage = `Please generate ${count} creative writing prompts.`;

        if (examplePrompt.trim()) {
            return `${baseMessage} Here's an example of the style I'm looking for:\n\n"${examplePrompt}"\n\nPlease provide ${count} similar prompts, each on a new line, numbered 1-${count}.`;
        }

        return `${baseMessage} Please provide ${count} diverse and engaging writing prompts, each on a new line, numbered 1-${count}.`;
    }

    private async makeRequest(request: AnthropicRequest): Promise<AnthropicResponse> {
        try {
            const response = await requestUrl({
                url: this.baseUrl,
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

    async testApiKey(model: AnthropicModel): Promise<{
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