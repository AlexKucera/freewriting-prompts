// ABOUTME: Settings interface and SettingTab implementation for the Freewriting Prompts plugin
// ABOUTME: Handles user configuration including API key, model selection, and prompt customization

import { App, ButtonComponent, DropdownComponent, Notice, PluginSettingTab, Setting } from 'obsidian';
import FreewritingPromptsPlugin from './main';
import { FreewritingPromptsSettings } from './types';
import { ModelOption } from './services/modelService';

/**
 * Default plugin settings applied on first installation.
 *
 * These defaults are chosen to:
 * - Use the most cost-effective model (Haiku) for testing
 * - Provide reasonable timing for timed prompts (6 seconds)
 * - Include example prompts that demonstrate expected styles
 * - Maintain reasonable limits on prompt counts
 */
export const DEFAULT_SETTINGS: FreewritingPromptsSettings = {
    /** Empty by default - user must provide their own API key */
    apiKey: '',
    /** Haiku is the fastest and most cost-effective model for prompt generation */
    model: 'claude-3-5-haiku-latest' as const,
    /** 10 prompts provides a good freewriting session length */
    timedCount: 10,
    /** 6 seconds allows time to read and respond without feeling rushed */
    delaySeconds: 6,
    /** 3 prompts is enough for a note without being overwhelming */
    noteCount: 3,
    /** Base system prompt guiding the AI's creative writing style */
    systemPrompt: 'You are a creative writing assistant. Generate engaging, thought-provoking writing prompts that inspire creativity and help writers overcome blocks. Focus on variety, originality, and emotional depth.',
    /** Example demonstrating short, immediate style for timed prompts */
    timedExamplePrompt: 'The interesting thing about a rose is…',
    /** Example demonstrating more elaborate style for note prompts */
    freewritingExamplePrompt: 'Describe a world where colors have been outlawed and only exist in secret underground galleries.'
};

/**
 * Settings UI tab for the Freewriting Prompts plugin.
 *
 * This class builds the settings interface with several key sections:
 * - API Configuration: API key, model selection, connection testing
 * - Command Configuration: Counts and timing for different prompt types
 * - Prompt Customization: System prompt and examples to guide style
 * - Actions: Cache clearing and other utility functions
 *
 * Key UX considerations:
 * - Model dropdown loads asynchronously to avoid blocking UI
 * - API key is masked as a password field
 * - Model refresh happens automatically when API key is entered
 * - Fallback to hardcoded models if API is unavailable
 * - Detailed test results help troubleshoot connection issues
 */
export class FreewritingPromptsSettingTab extends PluginSettingTab {
    plugin: FreewritingPromptsPlugin;
    /** Reference to model dropdown for dynamic updates */
    private modelDropdown: DropdownComponent | null = null;
    /** Cached list of available models for the dropdown */
    private availableModels: ModelOption[] = [];
    /** Debounce timer for API key changes to avoid excessive API calls */
    private apiKeyDebounceTimer: number | null = null;
    /** Debounce timer for settings saves to reduce disk writes */
    private settingsSaveTimer: number | null = null;
    /** Debounce delay in milliseconds */
    private readonly API_KEY_DEBOUNCE_MS = 500;
    /** Debounce delay for settings saves in milliseconds */
    private readonly SETTINGS_SAVE_DEBOUNCE_MS = 500;

    /**
     * Creates a new settings tab instance.
     *
     * @param app - Obsidian app instance
     * @param plugin - Plugin instance for accessing services and settings
     */
    constructor(app: App, plugin: FreewritingPromptsPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    /**
     * Cleanup method to clear any pending timers.
     * Called when settings tab is closed or destroyed.
     */
    hide(): void {
        if (this.apiKeyDebounceTimer !== null) {
            window.clearTimeout(this.apiKeyDebounceTimer);
            this.apiKeyDebounceTimer = null;
        }
        if (this.settingsSaveTimer !== null) {
            window.clearTimeout(this.settingsSaveTimer);
            this.settingsSaveTimer = null;
        }
    }

    /**
     * Debounces settings saves to reduce disk writes on rapid changes.
     * Clears any pending save and schedules a new one after the debounce delay.
     */
    private debounceSaveSettings(): void {
        if (this.settingsSaveTimer !== null) {
            window.clearTimeout(this.settingsSaveTimer);
        }
        this.settingsSaveTimer = window.setTimeout(() => {
            void this.plugin.saveSettings();
            this.settingsSaveTimer = null;
        }, this.SETTINGS_SAVE_DEBOUNCE_MS);
    }

    /**
     * Renders the settings UI.
     *
     * This method builds all settings sections and initiates async loading
     * of model data without blocking the UI. The model dropdown starts with
     * a "Loading models..." placeholder and updates when data arrives.
     */
    display(): void {
        const { containerEl } = this;
        containerEl.empty();

        containerEl.createEl('h2', { text: 'Freewriting Prompts' });

        // MARK: - API Configuration

        containerEl.createEl('h3', { text: 'API Configuration' });

        new Setting(containerEl)
            .setName('Anthropic API Key')
            .setDesc('Your Anthropic API key for Claude. Get one at https://console.anthropic.com/')
            .addText(text => text
                .setPlaceholder('sk-ant-...')
                .setValue(this.plugin.settings.apiKey)
                .onChange((value) => {
                    this.plugin.settings.apiKey = value;

                    // Clear any existing debounce timer
                    if (this.apiKeyDebounceTimer !== null) {
                        window.clearTimeout(this.apiKeyDebounceTimer);
                        this.apiKeyDebounceTimer = null;
                    }

                    // Debounce both saving and model refresh to reduce disk writes and API calls
                    this.apiKeyDebounceTimer = window.setTimeout(() => {
                        void (async () => {
                            await this.plugin.saveSettings();
                            // Note: updateApiKey is called by saveSettings only if key changed
                            // This avoids clearing the prompt cache twice

                            // Refresh models if API key has content
                            if (value.trim().length > 0) {
                                await this.refreshModels();
                            }
                            this.apiKeyDebounceTimer = null;
                        })();
                    }, this.API_KEY_DEBOUNCE_MS);
                }))
            .then(setting => {
                // Make it a password field
                setting.controlEl.querySelector('input')?.setAttribute('type', 'password');
            });

        new Setting(containerEl)
            .setName('Test API Key')
            .setDesc('Test your API key to verify it works correctly')
            .addButton(button => button
                .setButtonText('Test Connection')
                .onClick(() => {
                    void this.testApiKey(button);
                }));

        new Setting(containerEl)
            .setName('Claude Model')
            .setDesc('Which Claude model to use for generating prompts')
            .addDropdown(dropdown => {
                this.modelDropdown = dropdown;
                this.populateModelDropdown(dropdown);
                // Only set value if models are loaded to avoid setting non-existent options
                if (this.availableModels.length > 0) {
                    dropdown.setValue(this.plugin.settings.model);
                }
                dropdown.onChange((value) => {
                    this.plugin.settings.model = value;
                    this.debounceSaveSettings();
                });
            });

        // Load models asynchronously without blocking UI
        void this.loadModelsAsync();

        // MARK: - Command Configuration

        containerEl.createEl('h3', { text: 'Command Configuration' });

        new Setting(containerEl)
            .setName('Timed Prompts Count')
            .setDesc('Number of prompts to generate for timed notifications (1-50)')
            .addText(text => text
                .setPlaceholder('10')
                .setValue(this.plugin.settings.timedCount.toString())
                .onChange(async (value) => {
                    const count = parseInt(value);
                    if (!isNaN(count) && count >= 1 && count <= 50) {
                        this.plugin.settings.timedCount = count;
                        await this.plugin.saveSettings();
                    }
                }));

        new Setting(containerEl)
            .setName('Delay Between Prompts')
            .setDesc('Seconds to wait between each timed prompt notification (1-300)')
            .addText(text => text
                .setPlaceholder('6')
                .setValue(this.plugin.settings.delaySeconds.toString())
                .onChange(async (value) => {
                    const delay = parseInt(value);
                    if (!isNaN(delay) && delay >= 1 && delay <= 300) {
                        this.plugin.settings.delaySeconds = delay;
                        await this.plugin.saveSettings();
                    }
                }));

        new Setting(containerEl)
            .setName('Note Prompts Count')
            .setDesc('Number of prompts to append to the current note (1-20)')
            .addText(text => text
                .setPlaceholder('3')
                .setValue(this.plugin.settings.noteCount.toString())
                .onChange(async (value) => {
                    const count = parseInt(value);
                    if (!isNaN(count) && count >= 1 && count <= 20) {
                        this.plugin.settings.noteCount = count;
                        await this.plugin.saveSettings();
                    }
                }));

        // MARK: - Prompt Customization

        containerEl.createEl('h3', { text: 'Prompt Customization' });

        new Setting(containerEl)
            .setName('System Prompt')
            .setDesc('Instructions for the AI on how to generate prompts')
            .addTextArea(text => text
                .setPlaceholder('You are a creative writing assistant...')
                .setValue(this.plugin.settings.systemPrompt)
                .onChange((value) => {
                    this.plugin.settings.systemPrompt = value;
                    this.debounceSaveSettings();
                }))
            .then(setting => {
                setting.controlEl.querySelector('textarea')?.setAttribute('rows', '3');
            });

        new Setting(containerEl)
            .setName('Timed Prompts Example')
            .setDesc('Example prompt to guide the style for timed notifications')
            .addTextArea(text => text
                .setPlaceholder('Write about a character who...')
                .setValue(this.plugin.settings.timedExamplePrompt)
                .onChange((value) => {
                    this.plugin.settings.timedExamplePrompt = value;
                    this.debounceSaveSettings();
                }))
            .then(setting => {
                setting.controlEl.querySelector('textarea')?.setAttribute('rows', '2');
            });

        new Setting(containerEl)
            .setName('Note Prompts Example')
            .setDesc('Example prompt to guide the style for note prompts')
            .addTextArea(text => text
                .setPlaceholder('Describe a world where...')
                .setValue(this.plugin.settings.freewritingExamplePrompt)
                .onChange((value) => {
                    this.plugin.settings.freewritingExamplePrompt = value;
                    this.debounceSaveSettings();
                }))
            .then(setting => {
                setting.controlEl.querySelector('textarea')?.setAttribute('rows', '2');
            });

        // MARK: - Actions

        containerEl.createEl('h3', { text: 'Actions' });

        new Setting(containerEl)
            .setName('Clear Cache')
            .setDesc('Clear the cached prompts to force regeneration')
            .addButton(button => button
                .setButtonText('Clear Cache')
                .onClick(() => {
                    this.plugin.promptGenerator.clearCache();
                    // Show a temporary notice
                    const notice = new Notice('Cache cleared');
                    setTimeout(() => notice.hide(), 2000);
                }));

        new Setting(containerEl)
            .setName('Clear Model List Cache')
            .setDesc('Clear cached Claude model list to force a fresh fetch from the API')
            .addButton(button => button
                .setButtonText('Clear Models Cache')
                .onClick(() => {
                    this.plugin.modelService.clearCache();
                    // Show a temporary notice
                    const notice = new Notice('Model list cache cleared');
                    setTimeout(() => notice.hide(), 2000);
                }));
    }

    // MARK: - Model Loading

    /**
     * Loads available models from the API.
     *
     * This is the core model-fetching method that calls the ModelService.
     * Errors are logged but not shown to the user here - they're shown by
     * the ModelService itself via Notice popups.
     */
    private async loadModels(): Promise<void> {
        try {
            this.availableModels = await this.plugin.modelService.getAvailableModels();
        } catch (error) {
            console.error('Error loading models:', error);
            // Error already shown by ModelService via Notice
            // availableModels will be empty array, dropdown will be disabled
        }
    }

    /**
     * Loads models asynchronously without blocking UI rendering.
     *
     * This method is called after the UI is displayed to avoid blocking
     * the settings tab from appearing. The dropdown starts in a "Loading..."
     * state and updates when models arrive.
     *
     * If the current model is no longer available (e.g., deprecated), falls
     * back to the first available model and updates settings.
     */
    private async loadModelsAsync(): Promise<void> {
        await this.loadModels();

        // Update dropdown after models are loaded
        if (this.modelDropdown) {
            this.populateModelDropdown(this.modelDropdown);

            // Restore selected model if it still exists
            const currentModel = this.plugin.settings.model;
            const modelExists = this.availableModels.some(m => m.id === currentModel);
            if (modelExists) {
                this.modelDropdown.setValue(currentModel);
            } else {
                // Fall back to first available model if current one is gone
                const fallbackModel = this.availableModels[0];
                if (!fallbackModel) {
                    // Edge case: both API and fallback returned empty
                    this.modelDropdown.setDisabled(true);
                    this.modelDropdown.selectEl.empty();
                    this.modelDropdown.addOption('', 'No models available');
                } else if (this.plugin.settings.model !== fallbackModel.id) {
                    this.modelDropdown.setValue(fallbackModel.id);
                    this.plugin.settings.model = fallbackModel.id;
                    await this.plugin.saveSettings();
                    new Notice(`Your selected model is no longer available. Defaulting to ${fallbackModel.displayName} (${fallbackModel.id})`);
                }
            }
        }
    }

    /**
     * Populates the model dropdown with available models.
     *
     * If no models are available yet, shows a "Loading models..." placeholder
     * and disables the dropdown. Once models load, this is called again to
     * populate the real options.
     *
     * @param dropdown - Dropdown component to populate
     */
    private populateModelDropdown(dropdown: DropdownComponent): void {
        if (this.availableModels.length === 0) {
            // No models available yet, disable dropdown
            dropdown.addOption('', 'Loading models...');
            dropdown.setDisabled(true);
            return;
        }

        // Clear existing options
        dropdown.selectEl.empty();

        // Add all available models
        this.availableModels.forEach(model => {
            dropdown.addOption(model.id, model.displayName);
        });

        dropdown.setDisabled(false);
    }

    /**
     * Forces a refresh of the model list from the API.
     *
     * This is called when the user enters a new API key to ensure they see
     * models available for their specific account. Shows a "Refreshing..."
     * state during the fetch.
     *
     * If the current model is no longer available after refresh, falls back
     * to the first available model and notifies the user.
     */
    private async refreshModels(): Promise<void> {
        try {
            // Disable dropdown during refresh
            if (this.modelDropdown) {
                this.modelDropdown.setDisabled(true);
                this.modelDropdown.selectEl.empty();
                this.modelDropdown.addOption('', 'Refreshing models...');
            }

            // Fetch new models
            this.availableModels = await this.plugin.modelService.refreshModels();

            // Update dropdown
            if (this.modelDropdown) {
                this.populateModelDropdown(this.modelDropdown);

                // Restore selected model if it still exists
                const currentModel = this.plugin.settings.model;
                const modelExists = this.availableModels.some(m => m.id === currentModel);
                if (modelExists) {
                    this.modelDropdown.setValue(currentModel);
                } else {
                    // Fall back to first available model if current one is gone
                    const fallbackModel = this.availableModels[0];
                    if (fallbackModel && this.plugin.settings.model !== fallbackModel.id) {
                        this.modelDropdown.setValue(fallbackModel.id);
                        this.plugin.settings.model = fallbackModel.id;
                        new Notice(`Your selected model is no longer available. Defaulting to ${fallbackModel.displayName} (${fallbackModel.id})`);
                        // Save only if model actually changed
                        await this.plugin.saveSettings();
                    }
                }
            }
        } catch (error) {
            console.error('Error refreshing models:', error);
            // Error already shown by ModelService via Notice
        }
    }

    // MARK: - API Testing

    /**
     * Tests the configured API key by making a minimal request to Claude.
     *
     * This provides immediate feedback about whether:
     * - The API key is valid
     * - The network connection works
     * - The selected model is accessible
     * - Performance is reasonable (response time)
     *
     * Shows detailed success or failure information via Notice, including
     * troubleshooting guidance for common error scenarios.
     *
     * @param button - Button component to update with loading state
     */
    private async testApiKey(button: ButtonComponent): Promise<void> {
        const originalText = button.buttonEl.textContent || 'Test Connection';

        // Update button to show loading state
        button.setButtonText('Testing...');
        button.setDisabled(true);

        try {
            const client = this.plugin.promptGenerator.anthropicClient;
            const result = await client.testApiKey(this.plugin.settings.model);

            if (result.success) {
                // Success - show detailed information
                const details = result.details;
                const detailText = details ?
                    `\n\nDetails:\n• Model: ${details.model}\n• Response time: ${details.responseTime}ms\n• Input tokens: ${details.inputTokens || 'N/A'}\n• Output tokens: ${details.outputTokens || 'N/A'}` : '';

                new Notice(`✅ ${result.message}${detailText}`, 8000);
            } else {
                // Error - show detailed error information
                const errorDetails = result.details ?
                    `\n\nTroubleshooting:\n• Response time: ${result.details.responseTime}ms\n• Error type: ${result.error}` : '';

                new Notice(`❌ ${result.message}${errorDetails}`, 10000);
            }

        } catch (error) {
            console.error('Unexpected error during API test:', error);
            new Notice('❌ Unexpected error during API test. Check console for details.', 5000);
        } finally {
            // Restore button state
            button.setButtonText(originalText);
            button.setDisabled(false);
        }
    }
}