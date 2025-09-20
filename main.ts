// ABOUTME: Main plugin file for Freewriting Prompts - generates AI-powered writing prompts
// ABOUTME: Coordinates between services, commands, and Obsidian's plugin lifecycle

import { Editor, MarkdownView, Notice, Plugin } from 'obsidian';
import { FreewritingPromptsSettings } from './types';
import { DEFAULT_SETTINGS, FreewritingPromptsSettingTab } from './settings';
import { PromptGeneratorService } from './services/promptGenerator';
import { StaggeredPromptsCommand } from './commands/staggeredPrompts';
import { NotePromptsCommand } from './commands/notePrompts';

export default class FreewritingPromptsPlugin extends Plugin {
    settings: FreewritingPromptsSettings;
    promptGenerator: PromptGeneratorService;
    staggeredCommand: StaggeredPromptsCommand;
    noteCommand: NotePromptsCommand;

    async onload() {
        await this.loadSettings();

        // Initialize services
        this.promptGenerator = new PromptGeneratorService(this.settings);
        this.staggeredCommand = new StaggeredPromptsCommand(this.promptGenerator);
        this.noteCommand = new NotePromptsCommand(this.promptGenerator);

        // Register commands
        this.registerCommands();

        // Add settings tab
        this.addSettingTab(new FreewritingPromptsSettingTab(this.app, this));
    }

    onunload() {
        // Stop any running staggered prompts
        if (this.staggeredCommand) {
            this.staggeredCommand.stop();
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
        await this.saveData(this.settings);

        // Update the prompt generator with new settings
        if (this.promptGenerator) {
            this.promptGenerator.updateApiKey(this.settings.apiKey);
        }
    }

    // MARK: - Command Registration

    private registerCommands() {
        // Staggered prompts command
        this.addCommand({
            id: 'staggered-prompts',
            name: 'Show Staggered Prompts',
            callback: async () => {
                await this.executeStaggeredPrompts();
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

        // Stop staggered prompts command
        this.addCommand({
            id: 'stop-staggered-prompts',
            name: 'Stop Staggered Prompts',
            callback: () => {
                this.stopStaggeredPrompts();
            }
        });
    }

    // MARK: - Command Implementations

    private async executeStaggeredPrompts(): Promise<void> {
        // Check if staggered prompts are already running
        if (this.staggeredCommand.isRunning()) {
            new Notice('Staggered prompts are already running. Use "Stop Staggered Prompts" to stop them first.');
            return;
        }

        // Validate settings
        const validation = this.promptGenerator.validateSettings(this.settings);
        if (!validation.isValid) {
            new Notice(`Settings validation failed: ${validation.errors.join(', ')}`);
            return;
        }

        try {
            await this.staggeredCommand.execute(this.settings);
        } catch (error) {
            console.error('Error executing staggered prompts:', error);
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

    private stopStaggeredPrompts(): void {
        if (this.staggeredCommand.isRunning()) {
            this.staggeredCommand.stop();
            new Notice('Staggered prompts stopped');
        } else {
            new Notice('No staggered prompts are currently running');
        }
    }

    // MARK: - Public API for Settings

    getStaggeredStatus(): { isRunning: boolean; currentPrompt: number; totalPrompts: number } {
        return this.staggeredCommand.getStatus();
    }
}
