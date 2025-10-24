// ABOUTME: Settings interface and SettingTab implementation for the Freewriting Prompts plugin
// ABOUTME: Handles user configuration including API key, model selection, and prompt customization

import { App, ButtonComponent, DropdownComponent, Notice, PluginSettingTab, Setting } from 'obsidian';
import FreewritingPromptsPlugin from './main';
import { FreewritingPromptsSettings } from './types';
import { ModelOption } from './services/modelService';

export const DEFAULT_SETTINGS: FreewritingPromptsSettings = {
    apiKey: '',
    model: 'claude-3-5-haiku-latest' as const,
    timedCount: 10,
    delaySeconds: 6,
    noteCount: 3,
    systemPrompt: 'You are a creative writing assistant. Generate engaging, thought-provoking writing prompts that inspire creativity and help writers overcome blocks. Focus on variety, originality, and emotional depth.',
    timedExamplePrompt: 'The interesting thing about a rose is…',
    freewritingExamplePrompt: 'Describe a world where colors have been outlawed and only exist in secret underground galleries.'
};

export class FreewritingPromptsSettingTab extends PluginSettingTab {
    plugin: FreewritingPromptsPlugin;
    private modelDropdown: DropdownComponent | null = null;
    private availableModels: ModelOption[] = [];

    constructor(app: App, plugin: FreewritingPromptsPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    async display(): Promise<void> {
        const { containerEl } = this;
        containerEl.empty();

        containerEl.createEl('h2', { text: 'Freewriting Prompts' });

        // Load models asynchronously
        await this.loadModels();

        // MARK: - API Configuration

        containerEl.createEl('h3', { text: 'API Configuration' });

        new Setting(containerEl)
            .setName('Anthropic API Key')
            .setDesc('Your Anthropic API key for Claude. Get one at https://console.anthropic.com/')
            .addText(text => text
                .setPlaceholder('sk-ant-...')
                .setValue(this.plugin.settings.apiKey)
                .onChange(async (value) => {
                    this.plugin.settings.apiKey = value;
                    await this.plugin.saveSettings();
                    this.plugin.promptGenerator.updateApiKey(value);

                    // Trigger model refresh when API key is entered
                    if (value.trim().length > 0) {
                        await this.refreshModels();
                    }
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
                .onClick(async () => {
                    await this.testApiKey(button);
                }));

        new Setting(containerEl)
            .setName('Claude Model')
            .setDesc('Which Claude model to use for generating prompts')
            .addDropdown(dropdown => {
                this.modelDropdown = dropdown;
                this.populateModelDropdown(dropdown);
                dropdown
                    .setValue(this.plugin.settings.model)
                    .onChange(async (value) => {
                        this.plugin.settings.model = value;
                        await this.plugin.saveSettings();
                    });
            });

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
                .onChange(async (value) => {
                    this.plugin.settings.systemPrompt = value;
                    await this.plugin.saveSettings();
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
                .onChange(async (value) => {
                    this.plugin.settings.timedExamplePrompt = value;
                    await this.plugin.saveSettings();
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
                .onChange(async (value) => {
                    this.plugin.settings.freewritingExamplePrompt = value;
                    await this.plugin.saveSettings();
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
    }

    // MARK: - Model Loading

    private async loadModels(): Promise<void> {
        try {
            this.availableModels = await this.plugin.modelService.getAvailableModels();
        } catch (error) {
            console.error('Error loading models:', error);
            // Error already shown by ModelService via Notice
            // availableModels will be empty array, dropdown will be disabled
        }
    }

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
                    if (fallbackModel) {
                        this.modelDropdown.setValue(fallbackModel.id);
                        this.plugin.settings.model = fallbackModel.id;
                        new Notice('Your selected model is no longer available. Defaulting to ' + fallbackModel.displayName);
                    }
                }
            }

            // Persist any selection changes
            await this.plugin.saveSettings();
        } catch (error) {
            console.error('Error refreshing models:', error);
            // Error already shown by ModelService via Notice
        }
    }

    // MARK: - API Testing

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