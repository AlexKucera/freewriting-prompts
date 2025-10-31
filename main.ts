// ABOUTME: Main plugin file for Freewriting Prompts - generates AI-powered writing prompts
// ABOUTME: Coordinates between services, commands, and Obsidian's plugin lifecycle

import { Editor, MarkdownView, Notice, Plugin } from 'obsidian';
import { FreewritingPromptsSettings, FreewritingPromptsData, ModelCache } from './types';
import { DEFAULT_SETTINGS, FreewritingPromptsSettingTab } from './settings';
import { PromptGeneratorService } from './services/promptGenerator';
import { ModelService } from './services/modelService';
import { TimedPromptsCommand } from './commands/timedPrompts';
import { NotePromptsCommand } from './commands/notePrompts';

/**
 * Main plugin class for Freewriting Prompts.
 *
 * This plugin helps writers overcome creative blocks by generating AI-powered
 * writing prompts using Claude. It provides two main features:
 * 1. Timed prompts: Shows prompts as notifications at regular intervals
 * 2. Note prompts: Inserts prompts directly into the current note
 *
 * Architecture:
 * - Services: Core business logic (prompt generation, model management)
 * - Commands: User-facing actions (timed prompts, note prompts)
 * - API Client: Low-level Anthropic API communication
 * - Settings: User configuration UI and persistence
 *
 * The plugin manages the full lifecycle including initialization, cleanup,
 * settings persistence (including model cache), and command registration.
 */
export default class FreewritingPromptsPlugin extends Plugin {
    /** Current plugin settings */
    settings: FreewritingPromptsSettings;
    /** Service for generating writing prompts */
    promptGenerator: PromptGeneratorService;
    /** Service for managing available Claude models */
    modelService: ModelService;
    /** Command handler for timed prompt notifications */
    timedCommand: TimedPromptsCommand;
    /** Command handler for note prompt insertion */
    noteCommand: NotePromptsCommand;
    /** Tracks last saved API key to avoid unnecessary cache clears */
    private lastApiKey?: string;

    /**
     * Called when the plugin loads.
     *
     * Initializes all services and commands, loads settings and model cache
     * from disk, and registers commands with Obsidian. This method ensures
     * the model cache is loaded before ModelService tries to use it, avoiding
     * an unnecessary API call on startup.
     */
    async onload() {
        // Load data once and use it for both settings and model cache
        // Guard against corrupted persisted data to prevent plugin load failure
        let modelCache: ModelCache | undefined;
        try {
            const data = await this.loadData() as FreewritingPromptsData | null;
            if (data) {
                // Destructure to prevent modelCache from being merged into settings (type drift)
                const { modelCache: cache, ...savedSettings } = data;
                modelCache = cache;
                this.settings = Object.assign({}, DEFAULT_SETTINGS, savedSettings);
            } else {
                // No data loaded, use defaults
                this.settings = { ...DEFAULT_SETTINGS };
                modelCache = undefined;
            }
        } catch (error) {
            console.error('Failed to load settings; using defaults.', error);
            this.settings = { ...DEFAULT_SETTINGS };
            modelCache = undefined;
        }

        // Track initial API key to detect changes on save
        this.lastApiKey = this.settings.apiKey;

        // Initialize services
        this.promptGenerator = new PromptGeneratorService(this.settings);
        this.modelService = new ModelService(this.promptGenerator.anthropicClient);
        this.timedCommand = new TimedPromptsCommand(this.promptGenerator);
        this.noteCommand = new NotePromptsCommand(this.promptGenerator);

        // Load model cache
        if (modelCache) {
            this.modelService.loadCache(modelCache);
        }

        // Register commands
        this.registerCommands();

        // Add settings tab
        this.addSettingTab(new FreewritingPromptsSettingTab(this.app, this));
    }

    /**
     * Called when the plugin unloads.
     *
     * Performs cleanup to prevent memory leaks and ensure proper state:
     * - Stops any running timed prompts (clears intervals)
     * - Clears the in-memory prompt cache
     *
     * Model cache is NOT cleared here because it's persisted to disk and
     * should be available on next load.
     */
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

    /**
     * Saves plugin settings to disk.
     *
     * Includes both user settings and the model cache to avoid re-fetching
     * models on every startup. Updates the prompt generator with the new API
     * key if it changed.
     */
    async saveSettings() {
        // Save settings with model cache
        const data: FreewritingPromptsData = {
            ...this.settings,
            modelCache: this.modelService?.getCache() || undefined
        };
        await this.saveData(data);

        // Update the prompt generator only if API key actually changed
        // This avoids clearing the prompt cache unnecessarily on every save
        if (this.promptGenerator && this.lastApiKey !== this.settings.apiKey) {
            this.promptGenerator.updateApiKey(this.settings.apiKey);
            this.lastApiKey = this.settings.apiKey;
            // Clear model cache to ensure model list reflects new account entitlements
            // This prevents cross-key cache leakage if settings are changed programmatically
            this.modelService?.clearCache();
        }
    }

    // MARK: - Command Registration

    /**
     * Registers all plugin commands with Obsidian.
     *
     * Three commands are registered:
     * 1. 'timed-prompts': Starts a timed prompt sequence
     * 2. 'note-prompts': Inserts prompts into the current note
     * 3. 'stop-timed-prompts': Stops the active timed sequence
     *
     * Commands are available in the command palette and can be bound to hotkeys.
     */
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

    /**
     * Executes the timed prompts command.
     *
     * This method:
     * 1. Checks if timed prompts are already running
     * 2. Validates settings before making API calls
     * 3. Delegates to the TimedPromptsCommand for execution
     *
     * Shows user-friendly error messages for common issues like missing
     * API key or invalid settings.
     */
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

    /**
     * Executes the note prompts command.
     *
     * This method:
     * 1. Validates editor and view are available
     * 2. Validates settings before making API calls
     * 3. Delegates to the NotePromptsCommand for execution
     *
     * This is an editor command, so Obsidian ensures editor and view exist,
     * but we double-check for safety.
     *
     * @param editor - Active editor instance
     * @param view - Active markdown view
     */
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

    /**
     * Stops the currently running timed prompts sequence.
     *
     * Checks if prompts are actually running before attempting to stop
     * to provide appropriate feedback messages.
     */
    private stopTimedPrompts(): void {
        if (this.timedCommand.isRunning()) {
            this.timedCommand.stop();
            new Notice('Timed prompts stopped');
        } else {
            new Notice('No timed prompts are currently running');
        }
    }

    // MARK: - Public API for Settings

    /**
     * Gets the current status of the timed prompts sequence.
     *
     * This is used by the settings tab or status bar to show current progress.
     *
     * @returns Object containing running state and progress information
     */
    getTimedStatus(): { isRunning: boolean; currentPrompt: number; totalPrompts: number } {
        return this.timedCommand.getStatus();
    }
}
