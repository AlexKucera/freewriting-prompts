// ABOUTME: Service layer for generating writing prompts with caching and error handling
// ABOUTME: Coordinates between the Anthropic API client and plugin commands

import { Notice } from 'obsidian';
import { AnthropicClient } from '../api/anthropicClient';
import { FreewritingPromptsSettings, GeneratedPrompt, AnthropicModel } from '../types';

export class PromptGeneratorService {
    private client: AnthropicClient;
    private cache: Map<string, GeneratedPrompt[]> = new Map();
    private readonly cacheExpiryMs = 10 * 60 * 1000; // 10 minutes

    // Expose client for API testing in settings
    get anthropicClient(): AnthropicClient {
        return this.client;
    }

    constructor(settings: FreewritingPromptsSettings) {
        this.client = new AnthropicClient(settings.apiKey);
    }

    // MARK: - Public Methods

    async generateTimedPrompts(settings: FreewritingPromptsSettings): Promise<string[]> {
        return this.generatePrompts(
            settings.timedCount,
            settings.model,
            settings.systemPrompt,
            settings.timedExamplePrompt,
            'timed'
        );
    }

    async generateNotePrompts(settings: FreewritingPromptsSettings): Promise<string[]> {
        return this.generatePrompts(
            settings.noteCount,
            settings.model,
            settings.systemPrompt,
            settings.freewritingExamplePrompt,
            'note'
        );
    }

    updateApiKey(apiKey: string): void {
        this.client.updateApiKey(apiKey);
        this.clearCache(); // Clear cache when API key changes
    }

    clearCache(): void {
        this.cache.clear();
    }

    // MARK: - Private Methods

    private async generatePrompts(
        count: number,
        model: AnthropicModel,
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

    private createCacheKey(
        count: number,
        model: AnthropicModel,
        systemPrompt: string,
        examplePrompt: string,
        type: string
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

    validateSettings(settings: FreewritingPromptsSettings): { isValid: boolean; errors: string[] } {
        const errors: string[] = [];

        if (!settings.apiKey || settings.apiKey.trim().length === 0) {
            errors.push('API key is required');
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