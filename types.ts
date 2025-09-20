// ABOUTME: Type definitions for the Freewriting Prompts plugin
// ABOUTME: Defines interfaces for settings, API responses, and plugin configuration

export interface FreewritingPromptsSettings {
    apiKey: string;
    model: AnthropicModel;
    staggeredCount: number;
    delaySeconds: number;
    noteCount: number;
    systemPrompt: string;
    staggeredExamplePrompt: string;
    freewritingExamplePrompt: string;
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

export const ANTHROPIC_MODELS = [
    'claude-opus-4-1-20250805',
    'claude-opus-4-20250514',
    'claude-sonnet-4-20250514',
    'claude-3-7-sonnet-latest',
    'claude-3-5-haiku-latest',
    'claude-3-haiku-20240307'
] as const;

export type AnthropicModel = typeof ANTHROPIC_MODELS[number];