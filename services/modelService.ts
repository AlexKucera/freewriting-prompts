// ABOUTME: Service for managing Claude model list from Anthropic API
// ABOUTME: Handles fetching, caching with 24-hour TTL, and fallback to hardcoded list

import { Notice } from 'obsidian';
import { AnthropicClient } from '../api/anthropicClient';
import { ModelInfo, ModelCache, ANTHROPIC_MODELS } from '../types';

/**
 * Simplified model representation for UI display purposes.
 * Used to populate dropdown menus with user-friendly model names.
 */
export interface ModelOption {
    /** Model identifier (e.g., 'claude-3-5-haiku-latest') */
    id: string;
    /** Human-readable display name for the UI */
    displayName: string;
}

/**
 * Service responsible for managing the list of available Claude models.
 *
 * Key responsibilities:
 * - Fetches current model list from Anthropic API
 * - Caches results for 24 hours to minimize API calls
 * - Provides fallback to hardcoded model list when API is unavailable
 * - Handles graceful degradation when API key is not configured
 *
 * The 24-hour cache TTL balances freshness with API efficiency - models don't
 * change frequently enough to warrant more aggressive polling, but we want
 * users to see new models within a reasonable timeframe.
 */
export class ModelService {
    private anthropicClient: AnthropicClient;
    private modelCache: ModelCache | null = null;
    /** Cache time-to-live in milliseconds (24 hours) */
    private readonly CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
    /** Track whether we've shown the fallback notice this session to avoid spam */
    private hasShownFallbackNotice = false;
    /** In-flight fetch promise to deduplicate concurrent API calls */
    private inFlight: Promise<ModelOption[]> | null = null;

    /**
     * Creates a new model service instance.
     *
     * @param anthropicClient - Client for making API requests to Anthropic
     */
    constructor(anthropicClient: AnthropicClient) {
        this.anthropicClient = anthropicClient;
    }

    // MARK: - Public Methods

    /**
     * Retrieves available Claude models with intelligent caching and fallback.
     *
     * This method implements a three-tier strategy:
     * 1. Return cached models if valid (within 24-hour TTL)
     * 2. Fetch fresh models from API if cache is stale or empty
     * 3. Fall back to hardcoded ANTHROPIC_MODELS if API fails
     *
     * If no API key is configured, quietly returns fallback without showing errors,
     * since this is expected during initial plugin setup.
     *
     * @returns Array of model options formatted for UI display
     */
    async getAvailableModels(): Promise<ModelOption[]> {
        // Check if we have a valid cache
        if (this.isCacheValid() && this.modelCache) {
            return this.formatModels(this.modelCache.models);
        }

        // If no API key, quietly return fallback
        if (!this.anthropicClient.validateApiKey()) {
            return this.getFallbackModels();
        }

        // Use shared fetch path with deduplication
        return this.fetchWithDeduplication('Could not fetch latest models from API. Using default model list.');
    }

    /**
     * Forces a refresh of the model list from the API, bypassing cache.
     *
     * This is called when the user enters a new API key in settings, ensuring
     * they immediately see the correct models available for their account.
     * Falls back to hardcoded models if the API request fails.
     *
     * Uses the same in-flight deduplication as getAvailableModels to prevent
     * concurrent refreshModels and getAvailableModels calls from both hitting the API.
     *
     * @returns Array of current available models
     */
    async refreshModels(): Promise<ModelOption[]> {
        // If no API key, quietly return fallback
        if (!this.anthropicClient.validateApiKey()) {
            return this.getFallbackModels();
        }

        // Use shared fetch path with deduplication
        return this.fetchWithDeduplication('Fetching current models failed. Using hardcoded fallback list.');
    }

    /**
     * Loads cached model data from plugin persistent storage.
     *
     * Called during plugin initialization to restore the previous session's
     * model list, avoiding an immediate API call on every startup.
     *
     * @param cache - Previously saved cache data, or null if none exists
     */
    loadCache(cache: ModelCache | null): void {
        this.modelCache = cache;
    }

    /**
     * Retrieves current cache for persistence to disk.
     *
     * Called during plugin save operations to preserve the model cache
     * across Obsidian restarts, maintaining the 24-hour TTL.
     *
     * @returns Current cache state, or null if no cache exists
     */
    getCache(): ModelCache | null {
        return this.modelCache;
    }

    /**
     * Clears the cached model list, forcing a fresh fetch on next access.
     *
     * Also resets the fallback notice flag to allow showing error messages
     * again after manual cache reset. This prevents stale "notice already shown"
     * state across cache resets.
     *
     * Useful for testing or troubleshooting cache-related issues.
     */
    clearCache(): void {
        this.modelCache = null;
        this.hasShownFallbackNotice = false;
    }

    // MARK: - Private Methods

    /**
     * Shared fetch method with in-flight deduplication.
     *
     * This method is used by both getAvailableModels and refreshModels to prevent
     * concurrent calls from making duplicate API requests. If a fetch is already
     * in progress, subsequent calls will wait for and return the same promise.
     *
     * @param errorNoticeMessage - Message to show user if fetch fails
     * @returns Array of model options from the API or fallback
     */
    private async fetchWithDeduplication(errorNoticeMessage: string): Promise<ModelOption[]> {
        // Try to fetch from API (deduplicate concurrent calls)
        if (!this.inFlight) {
            this.inFlight = (async () => {
                const response = await this.anthropicClient.fetchModels();
                this.updateCache(response.data);
                // Reset notice flag on successful fetch
                this.hasShownFallbackNotice = false;
                return this.formatModels(response.data);
            })().finally(() => {
                this.inFlight = null;
            });
        }

        try {
            return await this.inFlight;
        } catch (error) {
            console.error('Failed to fetch models from API:', error);
            // Only show notice once per session to avoid spamming
            if (!this.hasShownFallbackNotice) {
                new Notice(errorNoticeMessage);
                this.hasShownFallbackNotice = true;
            }
            // Prefer stale cache over hardcoded fallback if available
            return this.getStaleCacheModels() ?? this.getFallbackModels();
        }
    }

    /**
     * Checks whether the current cache is still valid based on TTL.
     *
     * Cache is considered valid if it exists and was fetched less than
     * 24 hours ago. This prevents excessive API calls while ensuring
     * reasonable freshness of model data.
     *
     * @returns true if cache exists and is within TTL, false otherwise
     */
    private isCacheValid(): boolean {
        if (!this.modelCache) {
            return false;
        }

        const now = Date.now();
        const age = now - this.modelCache.fetchedAt;
        return age < this.CACHE_TTL_MS;
    }

    /**
     * Returns cached models if present, regardless of TTL.
     *
     * This is used as a fallback when API fetch fails - a slightly stale cache
     * is often better than falling back to the hardcoded model list, which may
     * be more outdated than the cached data.
     *
     * @returns Array of cached model options, or null if no cache exists
     */
    private getStaleCacheModels(): ModelOption[] | null {
        if (!this.modelCache) {
            return null;
        }
        return this.formatModels(this.modelCache.models);
    }

    /**
     * Updates the cache with freshly fetched model data.
     *
     * Deduplicates models by ID to guard against accidental duplicates
     * across pagination responses. Filters to include only model-like entries
     * (type contains "model") to exclude non-chat API entries if they appear
     * in future API responses. Sets the fetchedAt timestamp to now,
     * starting the 24-hour TTL countdown.
     *
     * @param models - Array of model information from the API
     */
    private updateCache(models: ModelInfo[]): void {
        // Deduplicate by id using Map and filter to model-like entries only
        const byId = new Map<string, ModelInfo>();
        for (const model of models) {
            // Filter out non-model entries (e.g., if API starts returning other types)
            // Keep entries where type contains "model" (case-insensitive)
            if (model.type && !/model/i.test(model.type)) {
                continue;
            }
            byId.set(model.id, model);
        }

        this.modelCache = {
            models: Array.from(byId.values()),
            fetchedAt: Date.now()
        };
    }

    /**
     * Transforms API model data into UI-friendly format.
     *
     * Prefers display_name when available for better UX, falls back to
     * model ID if display_name is missing. Results are sorted alphabetically
     * for easier scanning in the dropdown.
     *
     * @param models - Raw model info from API
     * @returns Formatted options ready for dropdown display
     */
    private formatModels(models: ModelInfo[]): ModelOption[] {
        return models.map(model => ({
            id: model.id,
            displayName: model.display_name || model.id
        })).sort((a, b) => a.displayName.localeCompare(b.displayName));
    }

    /**
     * Provides fallback model list when API is unavailable.
     *
     * Uses the hardcoded ANTHROPIC_MODELS constant which should be periodically
     * updated to include newly released models. This ensures the plugin remains
     * functional even during API outages or when no API key is configured.
     *
     * @returns Array of fallback model options
     */
    private getFallbackModels(): ModelOption[] {
        return ANTHROPIC_MODELS.map(id => ({
            id,
            displayName: id
        })).sort((a, b) => a.displayName.localeCompare(b.displayName));
    }
}
