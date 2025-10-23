// ABOUTME: Type definitions for the Freewriting Prompts plugin
// ABOUTME: Defines interfaces for settings, API responses, and plugin configuration

export interface FreewritingPromptsSettings {
    apiKey: string;
    model: string; // Changed from AnthropicModel to string to support dynamic models
    timedCount: number;
    delaySeconds: number;
    noteCount: number;
    systemPrompt: string;
    timedExamplePrompt: string;
    freewritingExamplePrompt: string;
}

export interface FreewritingPromptsData extends FreewritingPromptsSettings {
    modelCache?: ModelCache;
}

export interface AnthropicMessage {
    role: 'user' | 'assistant' | 'system';
    content: string;
}

export interface AnthropicRequest {
    model: string;
    max_tokens: number;
    messages: AnthropicMessage[];
    system?: string;
}

export interface AnthropicResponse {
    content: Array<{
        text: string;
        type: 'text';
    }>;
    id: string;
    model: string;
    role: 'assistant';
    stop_reason: string;
    stop_sequence: null;
    type: 'message';
    usage: {
        input_tokens: number;
        output_tokens: number;
    };
}

export interface GeneratedPrompt {
    text: string;
    timestamp: Date;
}

export interface ModelInfo {
    id: string;
    display_name?: string;
    created_at: string;
    type: string;
}

export interface ModelsListResponse {
    data: ModelInfo[];
    first_id: string;
    has_more: boolean;
    last_id: string;
}

export interface ModelCache {
    models: ModelInfo[];
    fetchedAt: number;
}

export const ANTHROPIC_MODELS = [
    'claude-opus-4-1-20250805',
    'claude-opus-4-20250514',
    'claude-sonnet-4-20250514',
    'claude-3-7-sonnet-latest',
    'claude-3-5-haiku-latest',
    'claude-3-haiku-20240307'
] as const;

export type AnthropicModel = typeof ANTHROPIC_MODELS[number];