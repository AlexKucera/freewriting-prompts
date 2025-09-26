// ABOUTME: Note prompts command implementation that appends prompts to the current note
// ABOUTME: Handles editor interaction, cursor positioning, and prompt formatting

import { App, Editor, MarkdownView, Notice } from 'obsidian';
import { PromptGeneratorService } from '../services/promptGenerator';
import { FreewritingPromptsSettings } from '../types';

export class NotePromptsCommand {
    constructor(private promptGenerator: PromptGeneratorService) {}

    // MARK: - Public Methods

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

    private insertPromptsIntoNote(editor: Editor, prompts: string[]): void {
        const cursor = editor.getCursor();
        const currentLine = editor.getLine(cursor.line);

        // Determine if we need to add a newline before our content
        const needsNewlineBefore = currentLine.trim().length > 0;

        // Format the prompts
        const formattedPrompts = this.formatPrompts(prompts);

        // Prepare the content to insert
        let contentToInsert = '';

        if (needsNewlineBefore) {
            contentToInsert += '\n';
        }

        contentToInsert += formattedPrompts;

        // If we're not at the end of the document, add a trailing newline
        const lastLine = editor.lastLine();
        if (cursor.line < lastLine) {
            contentToInsert += '\n';
        }

        // Insert the content at the cursor position
        editor.replaceSelection(contentToInsert);

        // Position cursor at the end of the inserted content
        const lines = contentToInsert.split('\n');
        const newCursorLine = cursor.line + lines.length - 1;
        const newCursorCh = lines[lines.length - 1].length;

        editor.setCursor(newCursorLine, newCursorCh);
    }

    private formatPrompts(prompts: string[]): string {
        const timestamp = new Date().toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });

        let formatted = `## Writing Prompts (${timestamp})\n\n`;

        prompts.forEach((prompt, index) => {
            formatted += `${index + 1}. ${prompt}\n\n`;
        });

        return formatted;
    }

    // MARK: - Utility Methods

    static canExecute(editor: Editor, view: MarkdownView): boolean {
        return !!(editor && view && view.file);
    }

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