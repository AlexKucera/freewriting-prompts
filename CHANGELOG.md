# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.1.1] - 2025-01-21

### Added
- Plugin combination recommendations for enhanced writing workflow

### Changed
- **Command Naming**: Renamed "Staggered Prompts" to "Timed Prompts" for better clarity
  - Command now called "Show Timed Prompts" instead of "Show Staggered Prompts"
  - Settings renamed from "Staggered Count" to "Timed Count"
  - All user-facing text updated to reflect regular interval timing rather than staggered/irregular timing

### Fixed
- **Type Safety**: Improved TypeScript type safety throughout codebase
  - Replaced `any` types with proper Obsidian API types (App, ButtonComponent)
  - Added null safety for button text content
  - Enhanced code quality and maintainability
- **Settings UI**: Removed redundant "Settings" text from settings tab heading

## [1.1.0] - 2025-01-20

### Changed
- **Enhanced Staggered Prompts**: Now generates ultra-short, direct prompts perfect for quick responses (1-5 words or single sentence)
- **Improved Timing**: Fixed staggered prompt display timing to prevent notification overlap with smooth fade transitions
- **Better Type Safety**: Simplified prompt generation model usage with proper TypeScript typing

### Fixed
- **Obsidian Compliance**: Moved inline styles to CSS for better theme compatibility
- **Command Naming**: Updated command names to follow Obsidian conventions ("Show Staggered Prompts", "Add Note Prompts")
- **Code Quality**: Removed TypeScript type casting issues and improved code structure

### Technical Details
- Type-specific prompt generation (staggered vs note prompts use different instructions)
- Dynamic notification duration based on user delay settings
- Enhanced Claude model support including latest Opus 4.1 and Sonnet models

## [1.0.0] - 2025-01-20

### Added
- **Staggered Freewriting Prompts** command for timed writing sessions
  - Configurable number of prompts (1-50, default: 10)
  - Configurable delay between prompts (1-300 seconds, default: 6)
  - Real-time prompt counter display in notifications
  - Stop command to cancel running staggered sessions
- **Freewriting Prompt** command for direct note insertion
  - Configurable number of prompts (1-20, default: 3)
  - Timestamped prompt lists inserted at cursor position
  - Formatted as bullet points with creation timestamp
- **AI-Powered Prompt Generation** using Anthropic's Claude API
  - Support for multiple Claude models (Haiku, Sonnet, Opus)
  - Customizable system prompts for personalized prompt styles
  - Example prompts for both staggered and note insertion modes
  - 10-minute intelligent caching to reduce API costs
- **Comprehensive Settings Interface**
  - API key configuration with secure storage
  - Model selection dropdown with latest Claude models
  - Timing and count configuration for both command types
  - Custom system prompt and example prompt configuration
  - API key test button with detailed feedback including response time and token usage
- **Cross-Platform Compatibility**
  - Works on both Obsidian desktop and mobile
  - No Node.js or Electron APIs used for maximum compatibility
- **Error Handling and User Feedback**
  - Detailed error messages for different API failure scenarios
  - Settings validation before command execution
  - Real-time status feedback during prompt generation
  - Network error recovery with user-friendly messages

### Technical Details
- Uses Obsidian's `requestUrl()` API for CORS-compliant HTTP requests
- Modular TypeScript architecture with separation of concerns
- Comprehensive type definitions for all interfaces
- Production-ready error handling and logging
- Follows Obsidian plugin development best practices

### Security
- API keys stored securely using Obsidian's data storage
- No sensitive information logged to console
- Input validation for all user settings
- Rate limiting awareness with appropriate error handling

[Unreleased]: https://github.com/AlexKucera/freewriting-prompts/compare/1.1.1...HEAD
[1.1.1]: https://github.com/AlexKucera/freewriting-prompts/compare/1.1.0...1.1.1
[1.1.0]: https://github.com/AlexKucera/freewriting-prompts/compare/1.0.0...1.1.0
[1.0.0]: https://github.com/AlexKucera/freewriting-prompts/releases/tag/1.0.0