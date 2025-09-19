// ABOUTME: Staggered prompts command implementation that shows prompts as timed notifications
// ABOUTME: Manages interval-based prompt display with proper cleanup and error handling

import { Notice } from 'obsidian';
import { PromptGeneratorService } from '../services/promptGenerator';
import { FreewritingPromptsSettings } from '../types';

export class StaggeredPromptsCommand {
    private activeInterval: number | null = null;
    private promptQueue: string[] = [];
    private currentIndex = 0;

    constructor(private promptGenerator: PromptGeneratorService) {}

    // MARK: - Public Methods

    async execute(settings: FreewritingPromptsSettings): Promise<void> {
        // Stop any existing staggered sequence
        this.stop();

        try {
            // Generate prompts
            const prompts = await this.promptGenerator.generateStaggeredPrompts(settings);

            if (prompts.length === 0) {
                new Notice('No prompts were generated');
                return;
            }

            // Initialize the prompt queue
            this.promptQueue = prompts;
            this.currentIndex = 0;

            // Show the first prompt immediately
            this.showCurrentPrompt();

            // If there are more prompts, start the interval
            if (prompts.length > 1) {
                this.startInterval(settings.delaySeconds);
            }

        } catch (error) {
            console.error('Error executing staggered prompts command:', error);
            // Error handling is done in the service layer
        }
    }

    stop(): void {
        if (this.activeInterval !== null) {
            clearInterval(this.activeInterval);
            this.activeInterval = null;
        }
        this.promptQueue = [];
        this.currentIndex = 0;
    }

    isRunning(): boolean {
        return this.activeInterval !== null;
    }

    // MARK: - Private Methods

    private startInterval(delaySeconds: number): void {
        this.activeInterval = window.setInterval(() => {
            this.currentIndex++;

            if (this.currentIndex < this.promptQueue.length) {
                this.showCurrentPrompt();
            } else {
                // We've shown all prompts, stop the interval
                this.stop();
                new Notice('All prompts have been shown');
            }
        }, delaySeconds * 1000);
    }

    private showCurrentPrompt(): void {
        if (this.currentIndex < this.promptQueue.length) {
            const prompt = this.promptQueue[this.currentIndex];
            const promptNumber = this.currentIndex + 1;
            const totalPrompts = this.promptQueue.length;

            // Create a longer-lasting notice for the prompt
            const notice = new Notice(
                `Writing Prompt ${promptNumber}/${totalPrompts}:\n\n${prompt}`,
                8000 // Show for 8 seconds
            );

            // Add some styling to make it more prominent
            const noticeEl = notice.noticeEl;
            if (noticeEl) {
                noticeEl.style.maxWidth = '400px';
                noticeEl.style.whiteSpace = 'pre-wrap';
                noticeEl.style.fontSize = '14px';
                noticeEl.style.lineHeight = '1.4';
                noticeEl.addClass('freewriting-prompt-notice');
            }
        }
    }

    // MARK: - Status Methods

    getStatus(): { isRunning: boolean; currentPrompt: number; totalPrompts: number } {
        return {
            isRunning: this.isRunning(),
            currentPrompt: this.currentIndex + 1,
            totalPrompts: this.promptQueue.length
        };
    }

    getRemainingPrompts(): string[] {
        if (this.currentIndex >= this.promptQueue.length) {
            return [];
        }
        return this.promptQueue.slice(this.currentIndex + 1);
    }
}