// ABOUTME: Note prompts command implementation that appends prompts to the current note
// ABOUTME: Handles editor interaction, cursor positioning, and prompt formatting

import { App, Editor, MarkdownView, Notice } from 'obsidian';
import { PromptGeneratorService } from '../services/promptGenerator';
import { FreewritingPromptsSettings } from '../types';

/**
 * Command handler for inserting writing prompts directly into notes.
 *
 * This command generates prompts and inserts them at the cursor position in
 * the active note as formatted markdown. Unlike timed prompts, these are
 * persistent and remain in the note for reference.
 *
 * Key responsibilities:
 * - Validates editor and view state before execution
 * - Generates prompts via the prompt service
 * - Formats prompts with timestamp and numbering
 * - Inserts at cursor with intelligent newline handling
 * - Positions cursor after inserted content
 *
 * The formatting includes a timestamp to help users track when prompts were
 * added, and numbered list format for easy reference.
 */
export class NotePromptsCommand {
    /**
     * Creates a new note prompts command handler.
     *
     * @param promptGenerator - Service for generating prompts from the API
     */
    constructor(private promptGenerator: PromptGeneratorService) {}

    // MARK: - Public Methods

    /**
     * Executes the note prompts insertion.
     *
     * This method:
     * 1. Validates that editor and view are available
     * 2. Generates prompts through the service
     * 3. Formats and inserts prompts at the cursor position
     * 4. Shows success feedback to the user
     *
     * @param settings - Current plugin settings for generation parameters
     * @param editor - Active editor instance for text insertion
     * @param view - Active markdown view for context
     */
    async execute(
        settings: FreewritingPromptsSettings,
        editor: Editor,
        view: MarkdownView
    ): Promise<void> {
        if (!editor || !view) {
            new Notice('No active note found. Please open a note first.');
            return;
        }

        try {
            // Generate prompts
            const prompts = await this.promptGenerator.generateNotePrompts(settings);

            if (prompts.length === 0) {
                new Notice('No prompts were generated');
                return;
            }

            // Format and insert prompts into the note
            this.insertPromptsIntoNote(editor, prompts);

            new Notice(`Added ${prompts.length} writing prompts to your note`);

        } catch (error) {
            console.error('Error executing note prompts command:', error);
            // Error handling is done in the service layer
        }
    }

    // MARK: - Private Methods

    /**
     * Inserts formatted prompts into the note at the cursor position.
     *
     * This method handles several edge cases:
     * - Collapses any text selection before insertion
     * - Adds newline before if there's text before the cursor
     * - Adds newline after if there's text after the cursor or more lines below
     * - Positions cursor at the end of inserted content
     *
     * The intelligent newline handling ensures prompts don't run into existing
     * text and maintains proper spacing in the document.
     *
     * @param editor - Editor instance for text manipulation
     * @param prompts - Array of prompt strings to insert
     */
    private insertPromptsIntoNote(editor: Editor, prompts: string[]): void {
        // Normalize to an insertion point (collapse any selection)
        const from = editor.getCursor('from');
        const to = editor.getCursor('to');
        const hasSelection = from.line !== to.line || from.ch !== to.ch;
        if (hasSelection) {
            editor.setSelection(from, from);
        }
        const cursor = editor.getCursor(); // refreshed after collapse
        const currentLine = editor.getLine(cursor.line) ?? '';

        const hasTextBefore = cursor.ch > 0 && currentLine.slice(0, cursor.ch).trim().length > 0;
        const hasTextAfter = cursor.ch < currentLine.length && currentLine.slice(cursor.ch).trim().length > 0;

        // Format the prompts
        const formattedPrompts = this.formatPrompts(prompts);

        // Prepare the content to insert
        const lastLine = editor.lastLine();
        let contentToInsert = '';
        if (hasTextBefore) contentToInsert += '\n';
        contentToInsert += formattedPrompts;
        if (hasTextAfter || cursor.line < lastLine) contentToInsert += '\n';

        // Insert the content at the cursor position
        editor.replaceSelection(contentToInsert);

        // Position cursor at the end of the inserted content
        const lines = contentToInsert.split('\n');
        const newCursorLine = cursor.line + lines.length - 1;
        const newCursorCh = lines[lines.length - 1].length;

        editor.setCursor(newCursorLine, newCursorCh);
    }

    /**
     * Formats prompts as markdown with timestamp header and numbered list.
     *
     * The format is:
     * ```
     * ## Writing Prompts (Jan 15, 2025, 02:30 PM)
     *
     * 1. [First prompt]
     *
     * 2. [Second prompt]
     * ```
     *
     * The timestamp helps users track when prompts were generated, and the
     * numbered list makes it easy to reference specific prompts.
     *
     * @param prompts - Array of prompt strings to format
     * @returns Formatted markdown string ready for insertion
     */
    private formatPrompts(prompts: string[]): string {
        const timestamp = new Intl.DateTimeFormat('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        }).format(new Date());

        let formatted = `## Writing Prompts (${timestamp})\n\n`;

        prompts.forEach((prompt, index) => {
            formatted += `${index + 1}. ${prompt}\n\n`;
        });

        return formatted;
    }

    // MARK: - Utility Methods

    /**
     * Checks whether the command can be executed in the current context.
     *
     * Validates that:
     * - Editor instance exists
     * - Markdown view exists
     * - An actual file is open (not just an empty pane)
     *
     * @param editor - Editor instance to validate
     * @param view - Markdown view to validate
     * @returns true if command can execute, false otherwise
     */
    static canExecute(editor: Editor, view: MarkdownView): boolean {
        return !!(editor && view && view.file);
    }

    /**
     * Retrieves the current execution context from the app.
     *
     * Helper method for getting the active editor and view without having
     * them explicitly passed. Useful for manual command invocation.
     *
     * @param app - Obsidian app instance
     * @returns Object containing editor and view, or nulls if not available
     */
    static getExecutionContext(app: App): { editor: Editor | null; view: MarkdownView | null } {
        const activeView = app.workspace.getActiveViewOfType(MarkdownView);

        if (!activeView) {
            return { editor: null, view: null };
        }

        return {
            editor: activeView.editor,
            view: activeView
        };
    }
}