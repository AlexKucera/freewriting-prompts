# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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

[Unreleased]: https://github.com/alexanderkucera/obsidian-freewriting-prompts/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/alexanderkucera/obsidian-freewriting-prompts/releases/tag/v1.0.0