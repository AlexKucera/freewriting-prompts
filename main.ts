// ABOUTME: Main plugin file for Freewriting Prompts - generates AI-powered writing prompts
// ABOUTME: Coordinates between services, commands, and Obsidian's plugin lifecycle

import { Editor, MarkdownView, Notice, Plugin } from 'obsidian';
import { FreewritingPromptsSettings, FreewritingPromptsData } from './types';
import { DEFAULT_SETTINGS, FreewritingPromptsSettingTab } from './settings';
import { PromptGeneratorService } from './services/promptGenerator';
import { ModelService } from './services/modelService';
import { TimedPromptsCommand } from './commands/timedPrompts';
import { NotePromptsCommand } from './commands/notePrompts';

export default class FreewritingPromptsPlugin extends Plugin {
    settings: FreewritingPromptsSettings;
    promptGenerator: PromptGeneratorService;
    modelService: ModelService;
    timedCommand: TimedPromptsCommand;
    noteCommand: NotePromptsCommand;

    async onload() {
        await this.loadSettings();

        // Initialize services
        this.promptGenerator = new PromptGeneratorService(this.settings);
        this.modelService = new ModelService(this.promptGenerator.anthropicClient);
        this.timedCommand = new TimedPromptsCommand(this.promptGenerator);
        this.noteCommand = new NotePromptsCommand(this.promptGenerator);

        // Load model cache
        const data = await this.loadData() as FreewritingPromptsData | null;
        if (data?.modelCache) {
            this.modelService.loadCache(data.modelCache);
        }

        // Register commands
        this.registerCommands();

        // Add settings tab
        this.addSettingTab(new FreewritingPromptsSettingTab(this.app, this));
    }

    onunload() {
        // Stop any running timed prompts
        if (this.timedCommand) {
            this.timedCommand.stop();
        }

        // Clear prompt cache
        if (this.promptGenerator) {
            this.promptGenerator.clearCache();
        }
    }

    // MARK: - Settings Management

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings() {
        // Save settings with model cache
        const data: FreewritingPromptsData = {
            ...this.settings,
            modelCache: this.modelService?.getCache() || undefined
        };
        await this.saveData(data);

        // Update the prompt generator with new settings
        if (this.promptGenerator) {
            this.promptGenerator.updateApiKey(this.settings.apiKey);
        }
    }

    // MARK: - Command Registration

    private registerCommands() {
        // Timed prompts command
        this.addCommand({
            id: 'timed-prompts',
            name: 'Show Timed Prompts',
            callback: async () => {
                await this.executeTimedPrompts();
            }
        });

        // Note prompt command (editor-based)
        this.addCommand({
            id: 'note-prompts',
            name: 'Add Note Prompts',
            editorCallback: async (editor: Editor, view: MarkdownView) => {
                await this.executeNotePrompts(editor, view);
            }
        });

        // Stop timed prompts command
        this.addCommand({
            id: 'stop-timed-prompts',
            name: 'Stop Timed Prompts',
            callback: () => {
                this.stopTimedPrompts();
            }
        });
    }

    // MARK: - Command Implementations

    private async executeTimedPrompts(): Promise<void> {
        // Check if timed prompts are already running
        if (this.timedCommand.isRunning()) {
            new Notice('Timed prompts are already running. Use "Stop Timed Prompts" to stop them first.');
            return;
        }

        // Validate settings
        const validation = this.promptGenerator.validateSettings(this.settings);
        if (!validation.isValid) {
            new Notice(`Settings validation failed: ${validation.errors.join(', ')}`);
            return;
        }

        try {
            await this.timedCommand.execute(this.settings);
        } catch (error) {
            console.error('Error executing timed prompts:', error);
            // Error handling is done in the command layer
        }
    }

    private async executeNotePrompts(editor: Editor, view: MarkdownView): Promise<void> {
        // Check if we can execute the command
        if (!NotePromptsCommand.canExecute(editor, view)) {
            new Notice('Please open a note and place your cursor where you want to insert prompts.');
            return;
        }

        // Validate settings
        const validation = this.promptGenerator.validateSettings(this.settings);
        if (!validation.isValid) {
            new Notice(`Settings validation failed: ${validation.errors.join(', ')}`);
            return;
        }

        try {
            await this.noteCommand.execute(this.settings, editor, view);
        } catch (error) {
            console.error('Error executing note prompts:', error);
            // Error handling is done in the command layer
        }
    }

    private stopTimedPrompts(): void {
        if (this.timedCommand.isRunning()) {
            this.timedCommand.stop();
            new Notice('Timed prompts stopped');
        } else {
            new Notice('No timed prompts are currently running');
        }
    }

    // MARK: - Public API for Settings

    getTimedStatus(): { isRunning: boolean; currentPrompt: number; totalPrompts: number } {
        return this.timedCommand.getStatus();
    }
}
