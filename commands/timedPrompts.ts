// ABOUTME: Timed prompts command implementation that shows prompts as timed notifications
// ABOUTME: Manages interval-based prompt display with proper cleanup and error handling

import { Notice } from 'obsidian';
import { PromptGeneratorService } from '../services/promptGenerator';
import { FreewritingPromptsSettings } from '../types';

/**
 * Command handler for displaying timed writing prompts as notifications.
 *
 * This command manages a sequence of prompts shown at regular intervals, useful
 * for freewriting sessions where the writer wants periodic prompts to maintain
 * creative flow.
 *
 * Key responsibilities:
 * - Generates a queue of prompts upfront (prevents race conditions)
 * - Displays prompts as timed Obsidian notifications
 * - Manages window.setInterval for timed display
 * - Prevents concurrent executions with inProgress flag
 * - Provides proper cleanup to prevent memory leaks
 *
 * The notification duration is calibrated to avoid overlap - each notification
 * disappears 500ms before the next one appears for a clean transition.
 */
export class TimedPromptsCommand {
    /** Active interval ID from window.setInterval, null when not running */
    private activeInterval: number | null = null;
    /** Queue of prompts to display, loaded at command start */
    private promptQueue: string[] = [];
    /** Index of the currently displayed or next-to-display prompt */
    private currentIndex = 0;
    /** Flag preventing concurrent command execution */
    private inProgress = false;

    /**
     * Creates a new timed prompts command handler.
     *
     * @param promptGenerator - Service for generating prompts from the API
     */
    constructor(private promptGenerator: PromptGeneratorService) {}

    // MARK: - Public Methods

    /**
     * Executes the timed prompts sequence.
     *
     * This method:
     * 1. Prevents race conditions by checking inProgress flag
     * 2. Stops any existing timed sequence
     * 3. Generates all prompts upfront to avoid async issues during intervals
     * 4. Shows the first prompt immediately
     * 5. Starts an interval to show remaining prompts
     *
     * The inProgress flag prevents concurrent executions during async prompt
     * generation. It's set to true before any async work begins and reset to
     * false in the finally block after all work completes, ensuring reliable
     * concurrency protection.
     *
     * @param settings - Current plugin settings for generation parameters
     */
    async execute(settings: FreewritingPromptsSettings): Promise<void> {
        // Check if already in progress to prevent race conditions
        if (this.inProgress) {
            new Notice('Timed prompts are already being generated. Please wait.');
            return;
        }

        // Set flag BEFORE any async work to prevent concurrent execution
        this.inProgress = true;

        // Stop any existing timed sequence (does NOT reset inProgress)
        this.stop();

        
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
            // Reset flag after all work completes (success or failure)
            // This ensures the flag is always reset and prevents stuck state
            this.inProgress = false;
        }
    }

    /**
     * Stops the currently running timed prompts sequence.
     *
     * Cleans up the interval timer and resets all state. This is important
     * for preventing memory leaks and ensuring the next execution starts fresh.
     * Safe to call even when no sequence is running.
     *
     * Note: Does NOT reset inProgress flag - that's managed by execute() to
     * prevent race conditions during async prompt generation.
     */
    stop(): void {
        if (this.activeInterval !== null) {
            clearInterval(this.activeInterval);
            this.activeInterval = null;
        }
        this.promptQueue = [];
        this.currentIndex = 0;
        // inProgress is NOT reset here - only execute() manages this flag
    }

    /**
     * Checks whether a timed prompts sequence is currently running.
     *
     * @returns true if prompts are being displayed on an interval, false otherwise
     */
    isRunning(): boolean {
        return this.activeInterval !== null;
    }

    // MARK: - Private Methods

    /**
     * Starts the interval timer for displaying subsequent prompts.
     *
     * The timer increments the current index and displays the next prompt
     * until the queue is exhausted. Automatically stops and shows a completion
     * notice when all prompts have been displayed.
     *
     * @param delaySeconds - Seconds to wait between each prompt display
     */
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

    /**
     * Displays the current prompt as an Obsidian notice.
     *
     * The notification includes:
     * - Current position in sequence (e.g., "3/10")
     * - The prompt text
     * - Custom CSS class for potential styling
     *
     * Notification duration is calibrated to avoid overlap with the next prompt,
     * disappearing 500ms before the next one arrives for smooth transitions.
     *
     * @param delaySeconds - Delay setting used to calculate notification duration
     */
    private showCurrentPrompt(delaySeconds: number): void {
        if (this.currentIndex < this.promptQueue.length) {
            const prompt = this.promptQueue[this.currentIndex];
            const promptNumber = this.currentIndex + 1;
            const totalPrompts = this.promptQueue.length;

            // Calculate notification duration: slightly less than delay to avoid overlap
            // For very short delays (<=1s), cap at 500ms; otherwise end 500ms before next tick
            const delayMs = delaySeconds * 1000;
            const notificationDuration = delayMs > 1000 ? (delayMs - 500) : 500;

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

    /**
     * Retrieves the current status of the timed prompts sequence.
     *
     * Provides information for UI feedback (like status bar displays) about
     * the current state of the prompt sequence.
     *
     * @returns Object containing running state and progress information
     */
    getStatus(): { isRunning: boolean; currentPrompt: number; totalPrompts: number } {
        const totalPrompts = this.promptQueue.length;
        const currentPrompt = totalPrompts === 0 ? 0 : Math.min(this.currentIndex + 1, totalPrompts);

        return {
            isRunning: this.isRunning(),
            currentPrompt,
            totalPrompts
        };
    }

    /**
     * Gets the prompts that haven't been displayed yet.
     *
     * Useful for debugging or if users want to preview upcoming prompts.
     *
     * @returns Array of remaining prompt strings, empty if sequence is complete
     */
    getRemainingPrompts(): string[] {
        if (this.currentIndex >= this.promptQueue.length) {
            return [];
        }
        return this.promptQueue.slice(this.currentIndex + 1);
    }
}