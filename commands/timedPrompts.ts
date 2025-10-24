// ABOUTME: Timed prompts command implementation that shows prompts as timed notifications
// ABOUTME: Manages interval-based prompt display with proper cleanup and error handling

import { Notice } from 'obsidian';
import { PromptGeneratorService } from '../services/promptGenerator';
import { FreewritingPromptsSettings } from '../types';

export class TimedPromptsCommand {
    private activeInterval: number | null = null;
    private promptQueue: string[] = [];
    private currentIndex = 0;
    private inProgress = false;

    constructor(private promptGenerator: PromptGeneratorService) {}

    // MARK: - Public Methods

    async execute(settings: FreewritingPromptsSettings): Promise<void> {
        // Check if already in progress to prevent race conditions
        if (this.inProgress) {
            new Notice('Timed prompts are already being generated. Please wait.');
            return;
        }

        // Stop any existing timed sequence
        this.stop();

        this.inProgress = true;
        try {
            // Generate prompts
            const prompts = await this.promptGenerator.generateTimedPrompts(settings);

            if (prompts.length === 0) {
                new Notice('No prompts were generated');
                return;
            }

            // Initialize the prompt queue
            this.promptQueue = prompts;
            this.currentIndex = 0;

            // Show the first prompt immediately
            this.showCurrentPrompt(settings.delaySeconds);

            // If there are more prompts, start the interval
            if (prompts.length > 1) {
                this.startInterval(settings.delaySeconds);
            }

        } catch (error) {
            console.error('Error executing timed prompts command:', error);
            // Error handling is done in the service layer
        } finally {
            this.inProgress = false;
        }
    }

    stop(): void {
        if (this.activeInterval !== null) {
            clearInterval(this.activeInterval);
            this.activeInterval = null;
        }
        this.promptQueue = [];
        this.currentIndex = 0;
        this.inProgress = false;
    }

    isRunning(): boolean {
        return this.activeInterval !== null;
    }

    // MARK: - Private Methods

    private startInterval(delaySeconds: number): void {
        this.activeInterval = window.setInterval(() => {
            this.currentIndex++;

            if (this.currentIndex < this.promptQueue.length) {
                this.showCurrentPrompt(delaySeconds);
            } else {
                // We've shown all prompts, stop the interval
                this.stop();
                new Notice('All prompts have been shown');
            }
        }, delaySeconds * 1000);
    }

    private showCurrentPrompt(delaySeconds: number): void {
        if (this.currentIndex < this.promptQueue.length) {
            const prompt = this.promptQueue[this.currentIndex];
            const promptNumber = this.currentIndex + 1;
            const totalPrompts = this.promptQueue.length;

            // Calculate notification duration: slightly less than delay to avoid overlap
            // Subtract 500ms to allow for fade-out before next prompt appears
            const notificationDuration = Math.max(1000, (delaySeconds * 1000) - 500);

            const notice = new Notice(
                `Writing Prompt ${promptNumber}/${totalPrompts}:\n\n${prompt}`,
                notificationDuration
            );

            // Add CSS class for styling
            const noticeEl = notice.noticeEl;
            if (noticeEl) {
                noticeEl.addClass('freewriting-prompt-notice');
            }
        }
    }

    // MARK: - Status Methods

    getStatus(): { isRunning: boolean; currentPrompt: number; totalPrompts: number } {
        const totalPrompts = this.promptQueue.length;
        const currentPrompt = totalPrompts === 0 ? 0 : Math.min(this.currentIndex + 1, totalPrompts);

        return {
            isRunning: this.isRunning(),
            currentPrompt,
            totalPrompts
        };
    }

    getRemainingPrompts(): string[] {
        if (this.currentIndex >= this.promptQueue.length) {
            return [];
        }
        return this.promptQueue.slice(this.currentIndex + 1);
    }
}