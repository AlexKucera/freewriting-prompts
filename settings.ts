// ABOUTME: Settings interface and SettingTab implementation for the Freewriting Prompts plugin
// ABOUTME: Handles user configuration including API key, model selection, and prompt customization

import { App, Notice, PluginSettingTab, Setting } from 'obsidian';
import FreewritingPromptsPlugin from './main';
import { FreewritingPromptsSettings, ANTHROPIC_MODELS } from './types';

export const DEFAULT_SETTINGS: FreewritingPromptsSettings = {
    apiKey: '',
    model: 'claude-3-5-haiku-latest' as const,
    staggeredCount: 10,
    delaySeconds: 6,
    noteCount: 3,
    systemPrompt: 'You are a creative writing assistant. Generate engaging, thought-provoking writing prompts that inspire creativity and help writers overcome blocks. Focus on variety, originality, and emotional depth.',
    staggeredExamplePrompt: 'The interesting thing about a rose is…',
    freewritingExamplePrompt: 'Describe a world where colors have been outlawed and only exist in secret underground galleries.'
};

export class FreewritingPromptsSettingTab extends PluginSettingTab {
    plugin: FreewritingPromptsPlugin;

    constructor(app: App, plugin: FreewritingPromptsPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const { containerEl } = this;
        containerEl.empty();

        containerEl.createEl('h2', { text: 'Freewriting Prompts Settings' });

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
                ANTHROPIC_MODELS.forEach(model => {
                    dropdown.addOption(model, model);
                });
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
            .setName('Staggered Prompts Count')
            .setDesc('Number of prompts to generate for staggered notifications (1-50)')
            .addText(text => text
                .setPlaceholder('10')
                .setValue(this.plugin.settings.staggeredCount.toString())
                .onChange(async (value) => {
                    const count = parseInt(value);
                    if (!isNaN(count) && count >= 1 && count <= 50) {
                        this.plugin.settings.staggeredCount = count;
                        await this.plugin.saveSettings();
                    }
                }));

        new Setting(containerEl)
            .setName('Delay Between Prompts')
            .setDesc('Seconds to wait between each staggered prompt notification (1-300)')
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
            .setName('Staggered Prompts Example')
            .setDesc('Example prompt to guide the style for staggered notifications')
            .addTextArea(text => text
                .setPlaceholder('Write about a character who...')
                .setValue(this.plugin.settings.staggeredExamplePrompt)
                .onChange(async (value) => {
                    this.plugin.settings.staggeredExamplePrompt = value;
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

    // MARK: - API Testing

    private async testApiKey(button: any): Promise<void> {
        const originalText = button.buttonEl.textContent;

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