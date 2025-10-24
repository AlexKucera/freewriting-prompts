// ABOUTME: Anthropic API client for generating writing prompts using Claude
// ABOUTME: Handles API requests, error handling, and response parsing

import { requestUrl } from 'obsidian';
import { AnthropicRequest, AnthropicResponse, ModelsListResponse } from '../types';

/**
 * Client for interacting with the Anthropic API to generate writing prompts.
 * Handles authentication, request formatting, error handling, and response parsing.
 *
 * This client manages two key responsibilities:
 * 1. Generating writing prompts using the Messages API
 * 2. Fetching available Claude models using the Models API
 *
 * It includes type-specific prompt modifiers to ensure timed prompts are short
 * and immediate while note prompts can be more elaborate and creative.
 */
export class AnthropicClient {
    private apiKey: string;
    /** Base URL for the Anthropic Messages API endpoint */
    private messagesUrl = 'https://api.anthropic.com/v1/messages';
    /** Base URL for the Anthropic Models API endpoint */
    private modelsUrl = 'https://api.anthropic.com/v1/models';

    /**
     * Suffix appended to all system prompts to enforce consistent output format.
     * Ensures Claude returns only numbered prompts without additional commentary,
     * which simplifies parsing and provides a predictable user experience.
     */
    private readonly SYSTEM_PROMPT_SUFFIX = '\n\nIMPORTANT OUTPUT REQUIREMENTS:\n- Return ONLY the numbered writing prompts, nothing else\n- Do not include any explanations, questions, or additional commentary\n- Do not ask if the user wants more prompts or different styles\n- Format: numbered list with one prompt per line (1. [prompt], 2. [prompt], etc.)';

    /**
     * Additional instructions for timed prompts to make them extremely brief.
     * Timed prompts appear as notifications and need to be answerable quickly,
     * so we enforce a short, concrete style optimized for rapid freewriting.
     */
    private readonly TIMED_PROMPT_MODIFIER = '\n\nFOR TIMED PROMPTS - MAKE THEM EXTREMELY SHORT AND DIRECT:\n- Each prompt should be answerable in 1-5 words or a single sentence\n- Focus on immediate, concrete observations or quick thoughts\n- Avoid complex scenarios or deep philosophical questions\n- Examples: "What color is closest to you?", "Your favorite word today:", "First sound you hear:", "Describe your mood in one word", "Name something soft"\n- Keep prompts simple, immediate, and concrete';

    /**
     * Creates a new Anthropic API client.
     * @param apiKey - The Anthropic API key for authentication
     */
    constructor(apiKey: string) {
        this.apiKey = apiKey;
    }

    // MARK: - Public Methods

    /**
     * Generates writing prompts using the Claude API.
     *
     * This method constructs an appropriate prompt based on the type (timed vs note),
     * applies relevant system instructions, and parses the response into an array
     * of clean prompt strings.
     *
     * Timed prompts use fewer tokens (256) for faster generation and lower cost,
     * while note prompts use more tokens (1000) for richer, more elaborate prompts.
     *
     * @param count - Number of prompts to generate
     * @param model - Claude model ID to use (e.g., 'claude-3-5-haiku-latest')
     * @param systemPrompt - Base system instructions for the AI
     * @param examplePrompt - Example prompt to guide the style
     * @param type - Whether this is for 'timed' notifications or 'note' insertion
     * @returns Array of generated prompt strings
     * @throws Error if API key is missing or API request fails
     */
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

            // Use smaller max_tokens for timed prompts to reduce latency/cost
            const maxTokens = type === 'timed' ? 256 : 1000;

            const request: AnthropicRequest = {
                model,
                max_tokens: maxTokens,
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

    /**
     * Fetches the list of available Claude models from the Anthropic API.
     *
     * This is used to populate the model selection dropdown in settings with
     * current available models rather than relying solely on hardcoded lists.
     * The response is cached by ModelService with a 24-hour TTL.
     *
     * @returns Response containing array of available models with metadata
     * @throws Error if API key is missing, request fails, or response is malformed
     */
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

            // Validate basic response structure
            const data = response.json as any;
            if (!data || !Array.isArray(data.data)) {
                throw new Error('Invalid models API response structure');
            }

            return data as ModelsListResponse;
        } catch (error) {
            if (error instanceof Error) {
                throw error;
            }
            throw new Error(`Network request failed: ${String(error)}`);
        }
    }

    // MARK: - Private Methods

    /**
     * Constructs the user message for prompt generation requests.
     *
     * If an example prompt is provided, it's included to guide the AI's style.
     * The message emphasizes the exact output format needed for reliable parsing.
     *
     * @param count - Number of prompts requested
     * @param examplePrompt - Optional example to demonstrate desired style
     * @returns Formatted user message string
     */
    private createUserMessage(count: number, examplePrompt: string): string {
        const baseMessage = `Generate exactly ${count} creative writing prompts. Return ONLY the numbered prompts with no additional text or commentary.`;

        if (examplePrompt.trim()) {
            return `${baseMessage}\n\nExample style: "${examplePrompt}"\n\nProvide ${count} similar prompts in this exact format:\n1. [prompt]\n2. [prompt]\n(etc.)`;
        }

        return `${baseMessage}\n\nProvide ${count} diverse writing prompts in this exact format:\n1. [prompt]\n2. [prompt]\n(etc.)`;
    }

    /**
     * Makes an HTTP request to the Anthropic Messages API.
     *
     * Handles authentication headers, request serialization, and basic error checking.
     * Uses Obsidian's requestUrl for compatibility with the plugin environment.
     *
     * @param request - Structured request payload for the API
     * @returns Parsed API response
     * @throws Error if request fails or returns non-2xx status
     */
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

    /**
     * Parses writing prompts from the API response.
     *
     * Extracts text content, splits by newlines, removes numbering prefixes,
     * and cleans whitespace to produce an array of ready-to-use prompt strings.
     *
     * This parsing assumes the AI follows the format specified in SYSTEM_PROMPT_SUFFIX.
     *
     * @param response - API response containing generated content
     * @returns Array of cleaned prompt strings
     * @throws Error if response is empty or contains no valid prompts
     */
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

    /**
     * Updates the API key used for authentication.
     * Called when the user changes their API key in settings.
     *
     * @param apiKey - New Anthropic API key
     */
    updateApiKey(apiKey: string): void {
        this.apiKey = apiKey;
    }

    /**
     * Validates that an API key is configured and non-empty.
     *
     * @returns true if API key exists and has content, false otherwise
     */
    validateApiKey(): boolean {
        return !!(this.apiKey && this.apiKey.trim().length > 0);
    }

    /**
     * Tests the configured API key by making a minimal request to Claude.
     *
     * This method sends a simple "ping" request to verify:
     * - The API key is valid and authorized
     * - The network connection works
     * - The selected model is available
     *
     * It uses minimal tokens (max_tokens: 10) to keep costs negligible while
     * still exercising the full authentication and request pipeline.
     *
     * @param model - Claude model ID to test with
     * @returns Detailed test result including success status, timing, and error details
     */
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

    /**
     * Parses errors from API test attempts into user-friendly messages.
     *
     * Categorizes errors by HTTP status code and error type to provide
     * specific troubleshooting guidance. This helps users quickly identify
     * whether the issue is with their API key, account, network, or the service.
     *
     * @param error - Caught error object (typically an Error instance)
     * @param responseTime - How long the request took before failing
     * @returns Structured error result with categorization and guidance
     */
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