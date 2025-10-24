// ABOUTME: Service layer for generating writing prompts with caching and error handling
// ABOUTME: Coordinates between the Anthropic API client and plugin commands

import { Notice } from 'obsidian';
import { AnthropicClient } from '../api/anthropicClient';
import { FreewritingPromptsSettings, GeneratedPrompt } from '../types';

/**
 * Service that coordinates prompt generation between commands and the API client.
 *
 * This service layer provides:
 * - High-level methods for different prompt types (timed vs note)
 * - In-memory caching with 10-minute TTL to avoid redundant API calls
 * - Settings validation before attempting generation
 * - User feedback via Obsidian notices
 * - Error handling and propagation
 *
 * The 10-minute cache is relatively short because:
 * 1. Users expect fresh prompts when they explicitly request them
 * 2. The cache prevents rapid-fire duplicate requests during a single session
 * 3. Memory usage is minimal (cache is just strings with timestamps)
 */
export class PromptGeneratorService {
    private client: AnthropicClient;
    /** In-memory cache mapping request parameters to generated prompts */
    private cache: Map<string, GeneratedPrompt[]> = new Map();
    /** Cache expiry time in milliseconds (10 minutes) */
    private readonly cacheExpiryMs = 10 * 60 * 1000; // 10 minutes

    /**
     * Exposes the underlying API client for direct access.
     * Used by settings tab to test API key connectivity.
     */
    get anthropicClient(): AnthropicClient {
        return this.client;
    }

    /**
     * Creates a new prompt generator service.
     *
     * @param settings - Plugin settings containing API key and configuration
     */
    constructor(settings: FreewritingPromptsSettings) {
        this.client = new AnthropicClient(settings.apiKey);
    }

    // MARK: - Public Methods

    /**
     * Generates prompts optimized for timed notifications.
     *
     * These prompts are short and answerable quickly since they appear as
     * timed notifications during freewriting sessions. Uses the timedExamplePrompt
     * to guide style and applies special system instructions for brevity.
     *
     * @param settings - Current plugin settings
     * @returns Array of short, focused prompts for rapid response
     * @throws Error if API key is invalid or generation fails
     */
    async generateTimedPrompts(settings: FreewritingPromptsSettings): Promise<string[]> {
        return this.generatePrompts(
            settings.timedCount,
            settings.model,
            settings.systemPrompt,
            settings.timedExamplePrompt,
            'timed'
        );
    }

    /**
     * Generates prompts for insertion into notes.
     *
     * These prompts can be more elaborate and creative since they're inserted
     * as text into a note rather than appearing as brief notifications. Uses
     * the freewritingExamplePrompt to guide style.
     *
     * @param settings - Current plugin settings
     * @returns Array of creative prompts suitable for note insertion
     * @throws Error if API key is invalid or generation fails
     */
    async generateNotePrompts(settings: FreewritingPromptsSettings): Promise<string[]> {
        return this.generatePrompts(
            settings.noteCount,
            settings.model,
            settings.systemPrompt,
            settings.freewritingExamplePrompt,
            'note'
        );
    }

    /**
     * Updates the API key for the underlying client.
     *
     * Called when the user changes their API key in settings. Clears the cache
     * since previous cached prompts may have been generated with a different key.
     *
     * @param apiKey - New Anthropic API key
     */
    updateApiKey(apiKey: string): void {
        this.client.updateApiKey(apiKey);
        this.clearCache(); // Clear cache when API key changes
    }

    /**
     * Clears all cached prompts.
     *
     * Forces fresh generation on next request. Useful when users want to
     * ensure they're getting completely new prompts rather than cached ones.
     */
    clearCache(): void {
        this.cache.clear();
    }

    // MARK: - Private Methods

    /**
     * Core prompt generation method with caching logic.
     *
     * Implements the full generation flow:
     * 1. Validates API key configuration
     * 2. Checks cache for matching prompts within TTL
     * 3. Calls API if cache miss or expired
     * 4. Stores results in cache with timestamp
     * 5. Shows user feedback via notices
     *
     * The cache key is derived from all generation parameters to ensure
     * cached prompts match the current settings exactly.
     *
     * @param count - Number of prompts to generate
     * @param model - Claude model ID to use
     * @param systemPrompt - Base system instructions
     * @param examplePrompt - Example to guide style
     * @param type - Prompt type ('timed' or 'note') affecting format and length
     * @returns Array of generated prompt strings
     * @throws Error if API key is missing or API call fails
     */
    private async generatePrompts(
        count: number,
        model: string,
        systemPrompt: string,
        examplePrompt: string,
        type: 'timed' | 'note'
    ): Promise<string[]> {
        if (!this.client.validateApiKey()) {
            new Notice('Please configure your Anthropic API key in settings');
            throw new Error('API key not configured');
        }

        const cacheKey = this.createCacheKey(count, model, systemPrompt, examplePrompt, type);
        const cachedPrompts = this.getCachedPrompts(cacheKey);

        if (cachedPrompts) {
            return cachedPrompts.map(p => p.text);
        }

        try {
            new Notice('Generating prompts...');
            const prompts = await this.client.generatePrompts(count, model, systemPrompt, examplePrompt, type);

            const generatedPrompts: GeneratedPrompt[] = prompts.map(text => ({
                text,
                timestamp: new Date()
            }));

            this.cache.set(cacheKey, generatedPrompts);
            new Notice(`Generated ${prompts.length} writing prompts`);

            return prompts;
        } catch (error) {
            console.error('Error in PromptGeneratorService:', error);
            if (error instanceof Error) {
                new Notice(`Error generating prompts: ${error.message}`);
            } else {
                new Notice('Unknown error occurred while generating prompts');
            }
            throw error;
        }
    }

    /**
     * Creates a unique cache key from generation parameters.
     *
     * The key is a JSON string containing all parameters that affect output.
     * This ensures we only serve cached prompts when ALL settings match,
     * preventing incorrect reuse when the user changes any configuration.
     *
     * @param count - Number of prompts
     * @param model - Model ID
     * @param systemPrompt - System instructions
     * @param examplePrompt - Example prompt
     * @param type - Prompt type
     * @returns JSON string uniquely identifying this parameter combination
     */
    private createCacheKey(
        count: number,
        model: string,
        systemPrompt: string,
        examplePrompt: string,
        type: 'timed' | 'note'
    ): string {
        const keyData = {
            count,
            model,
            systemPrompt: systemPrompt.trim(),
            examplePrompt: examplePrompt.trim(),
            type
        };
        return JSON.stringify(keyData);
    }

    /**
     * Retrieves cached prompts if they exist and are still valid.
     *
     * Checks both existence and age of cached prompts. Returns null if:
     * - No cache entry exists for this key
     * - Cache entry is empty (defensive guard)
     * - Cache is older than 10 minutes (expired)
     *
     * Expired entries are automatically removed from the cache map.
     *
     * @param cacheKey - Cache key to look up
     * @returns Array of cached prompts if valid, null otherwise
     */
    private getCachedPrompts(cacheKey: string): GeneratedPrompt[] | null {
        const cached = this.cache.get(cacheKey);
        if (!cached) {
            return null;
        }

        // Guard against empty cache arrays
        if (cached.length === 0) {
            this.cache.delete(cacheKey);
            return null;
        }

        const now = new Date().getTime();
        const cacheTime = cached[0].timestamp.getTime();

        if (now - cacheTime > this.cacheExpiryMs) {
            this.cache.delete(cacheKey);
            return null;
        }

        return cached;
    }

    // MARK: - Validation Methods

    /**
     * Validates plugin settings before attempting prompt generation.
     *
     * Checks all settings that affect prompt generation to provide early
     * feedback before making API calls. Validates:
     * - API key is present
     * - Model ID is specified
     * - Numeric settings are within acceptable ranges
     *
     * This validation prevents API errors and gives users clear guidance
     * about what needs to be fixed in their configuration.
     *
     * @param settings - Settings to validate
     * @returns Object containing validity status and array of error messages
     */
    validateSettings(settings: FreewritingPromptsSettings): { isValid: boolean; errors: string[] } {
        const errors: string[] = [];

        if (!settings.apiKey || settings.apiKey.trim().length === 0) {
            errors.push('API key is required');
        }

        if (!settings.model || settings.model.trim().length === 0) {
            errors.push('Claude model is required');
        }

        if (settings.timedCount < 1 || settings.timedCount > 50) {
            errors.push('Timed count must be between 1 and 50');
        }

        if (settings.delaySeconds < 1 || settings.delaySeconds > 300) {
            errors.push('Delay seconds must be between 1 and 300');
        }

        if (settings.noteCount < 1 || settings.noteCount > 20) {
            errors.push('Note count must be between 1 and 20');
        }

        return {
            isValid: errors.length === 0,
            errors
        };
    }
}