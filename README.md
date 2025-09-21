# Freewriting Prompts

[![GitHub release (latest by date)](https://img.shields.io/github/v/release/alexanderkucera/obsidian-freewriting-prompts)](https://github.com/alexanderkucera/obsidian-freewriting-prompts/releases)
[![License: MIT](https://img.shields.io/github/license/alexanderkucera/obsidian-freewriting-prompts?color=yellow)](https://opensource.org/licenses/MIT)
![](https://img.shields.io/badge/mobile_supported-green?label=obsidian&labelColor=purple)

Generate AI-powered writing prompts for freewriting sessions using Anthropic's Claude. Break through writer's block with creative, thought-provoking prompts delivered exactly when you need them.

## Table of Contents

- [Key Features](#key-features)
- [Why This Plugin?](#why-this-plugin)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Configuration](#configuration)
- [Commands](#commands)
- [Settings](#settings)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)
- [License](#license)

## Key Features

- **🎯 Two Prompt Modes**: Timed notifications for writing sessions, or direct note insertion
- **🤖 AI-Powered**: Uses Anthropic's Claude models for creative, diverse prompt generation
- **⚡ Customizable Timing**: Configure prompt count and delay intervals for your writing rhythm
- **🎨 Personalized Prompts**: System prompts and examples to match your writing style
- **📱 Cross-Platform**: Works on both desktop and mobile Obsidian
- **🔧 Smart Caching**: Avoid redundant API calls with intelligent prompt caching
- **🔑 API Key Testing**: Built-in connectivity testing with detailed feedback
- **⏱️ Real-Time Progress**: Visual feedback for prompt generation and delivery

## Why This Plugin?

Writer's block is real, and sometimes you need external inspiration to get the creative juices flowing. This plugin was born from the need for:

- **Timed Writing Sessions**: Get prompts delivered at intervals to maintain writing momentum
- **Instant Inspiration**: Generate multiple prompts directly in your notes when needed
- **Quality Over Quantity**: AI-generated prompts that are actually interesting and thought-provoking
- **Seamless Integration**: Works within your existing Obsidian workflow without disruption

Rather than browsing random prompt websites or books, get personalized, AI-generated prompts delivered right in your writing environment.

## Perfect Plugin Combination

This plugin works exceptionally well with other freewriting tools to create a complete writing workflow:

### ✍️ [Freewriting Cleanup](https://github.com/AlexKucera/freewriting-cleanup)
Transform your messy freewriting into polished prose using AI. Perfect companion to this plugin:
1. **Generate inspiration** with creative prompts from this plugin
2. **Write freely** without worrying about mistakes
3. **Clean up the output** with Freewriting Cleanup to polish your raw writing

### 📝 [Digital Paper](https://github.com/danferns/digital-paper-obsidian-plugin)
Write without the ability to delete or edit - just like pen on paper. Perfect for true freewriting sessions:
1. **Enable Digital Paper mode** to disable all delete functions (backspace, delete key, Ctrl+X)
2. **Use this plugin** to generate writing prompts for inspiration
3. **Write continuously** without stopping to edit or second-guess yourself
4. **Clean up afterwards** using Freewriting Cleanup to polish the unedited output

**Recommended Workflow:**
- Generate prompts with this plugin when you need inspiration
- Enable Digital Paper mode for uninterrupted freewriting sessions
- Use Freewriting Cleanup to polish your raw, unedited writing into readable text

## Installation

### Method 1: Community Plugin Store (Recommended)

1. Open **Settings** → **Community Plugins**
2. **Disable Safe Mode** if needed
3. Click **Browse** and search for "Freewriting Prompts"
4. **Install** and **Enable** the plugin

### Method 2: Manual Installation

1. Go to [GitHub Releases](https://github.com/alexanderkucera/obsidian-freewriting-prompts/releases)
2. Download the latest `main.js`, `manifest.json`, and `styles.css`
3. Create a folder `{VaultFolder}/.obsidian/plugins/freewriting-prompts/`
4. Place the downloaded files in this folder
5. Reload Obsidian (`Ctrl/Cmd + R` or restart)
6. Enable the plugin in **Settings** → **Community Plugins**

### Method 3: BRAT (Beta Reviewer's Auto-update Tool)

1. Install the [BRAT plugin](https://github.com/TfTHacker/obsidian42-brat)
2. Add this repository: `alexanderkucera/obsidian-freewriting-prompts`
3. Enable the plugin after installation

## Quick Start

### 1. Get Your Anthropic API Key

1. Visit [Anthropic Console](https://console.anthropic.com/)
2. Create an account or sign in
3. Generate an API key from the dashboard
4. Copy the key (starts with `sk-ant-`)

### 2. Configure the Plugin

1. Go to **Settings** → **Community Plugins** → **Freewriting Prompts**
2. Paste your API key in the **Anthropic API Key** field
3. Click **Test Connection** to verify it works
4. Adjust other settings as desired

### 3. Start Using Prompts

**For Timed Writing Sessions:**
1. Use `Ctrl/Cmd + P` → "Show Timed Prompts"
2. Prompts will appear as notifications at your configured intervals

**For Note Integration:**
1. Open any note and place your cursor where you want prompts
2. Use `Ctrl/Cmd + P` → "Freewriting Prompt"
3. Prompts will be inserted directly into your note

## Configuration

### API Configuration

| Setting | Description | Default |
|---------|-------------|---------|
| **API Key** | Your Anthropic API key | _(required)_ |
| **Model** | Claude model to use | claude-3-haiku-20240307 |

### Command Configuration

| Setting | Description | Default | Range |
|---------|-------------|---------|-------|
| **Timed Count** | Number of timed prompts | 10 | 1-50 |
| **Delay Seconds** | Seconds between prompts | 6 | 1-300 |
| **Note Count** | Prompts inserted in notes | 3 | 1-20 |

### Prompt Customization

- **System Prompt**: Instructions for the AI on how to generate prompts
- **Timed Example**: Example prompt for timed sessions
- **Freewriting Example**: Example prompt for note insertion

## Commands

### Timed Freewriting Prompts

Delivers prompts as timed notifications perfect for writing sprints:

1. Generates your configured number of prompts
2. Shows the first prompt immediately
3. Delivers remaining prompts at your specified intervals
4. Each notification shows "Prompt X/Y" with the writing prompt

**Use Cases:**
- Timed writing sessions (Pomodoro technique)
- Breaking through writer's block
- Maintaining writing momentum
- Creative warm-up exercises

### Freewriting Prompt

Inserts prompts directly into your current note:

1. Generates prompts based on your settings
2. Inserts them at your cursor position
3. Formats as a timestamped list
4. Perfect for collecting prompts for later use

**Use Cases:**
- Building prompt collections
- Planning writing sessions
- Creating prompt libraries
- Inspiration gathering

### Stop Timed Prompts

Cancels any running timed prompt sequence.

## Settings

### Advanced Features

- **Test API Key**: Verify your connection with detailed feedback including:
  - Response time
  - Token usage
  - Model confirmation
  - Specific error messages for troubleshooting

- **Clear Cache**: Force regeneration of prompts by clearing the 10-minute cache

### Supported Models

- claude-3-haiku-20240307 (fastest, most cost-effective)
- claude-3-sonnet-20240229 (balanced performance)
- claude-3-opus-20240229 (highest quality)
- claude-3-5-sonnet-20241022 (latest sonnet)
- claude-3-5-haiku-20241022 (latest haiku)

## Troubleshooting

### Common Issues

| Problem | Solution |
|---------|----------|
| **"API key is required"** | Enter your Anthropic API key in settings |
| **"Network error"** | Check internet connection and API key validity |
| **"Rate limit exceeded"** | Wait a moment and try again, or upgrade your Anthropic plan |
| **No prompts generated** | Verify API key works with the test button |

### Error Messages

The plugin provides detailed error messages for different scenarios:

- **401 Unauthorized**: Invalid API key
- **403 Forbidden**: Account or billing issues
- **429 Rate Limited**: Too many requests
- **500 Server Error**: Anthropic service issues
- **Network Error**: Connection problems

### Debug Steps

1. **Test API Key**: Use the "Test Connection" button in settings
2. **Check Console**: Open Developer Tools (F12) for detailed error logs
3. **Verify Settings**: Ensure all required fields are filled
4. **Clear Cache**: Try clearing the prompt cache
5. **Restart Plugin**: Disable and re-enable the plugin

### Getting Help

- **Issues**: Report bugs on [GitHub Issues](https://github.com/alexanderkucera/obsidian-freewriting-prompts/issues)
- **Discussions**: Ask questions in [GitHub Discussions](https://github.com/alexanderkucera/obsidian-freewriting-prompts/discussions)

## Development

### Setup

```bash
# Clone the repository
git clone https://github.com/alexanderkucera/obsidian-freewriting-prompts.git
cd obsidian-freewriting-prompts

# Install dependencies
npm install

# Start development server
npm run dev
```

### Project Structure

```
freewriting-prompts/
├── api/
│   └── anthropicClient.ts    # Anthropic API integration
├── commands/
│   ├── timedPrompts.ts       # Timed notification prompts
│   └── notePrompts.ts        # Note insertion prompts
├── services/
│   └── promptGenerator.ts    # Prompt generation service
├── main.ts                   # Plugin entry point
├── settings.ts               # Settings interface
└── types.ts                  # Type definitions
```

### Build Commands

```bash
npm run dev      # Development with file watching
npm run build    # Production build with type checking
npm run version  # Version bump and manifest update
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

### Development Guidelines

1. **Fork** the repository
2. **Create** a feature branch: `git checkout -b feature/amazing-feature`
3. **Follow** TypeScript and ESLint conventions
4. **Test** your changes thoroughly
5. **Commit** with descriptive messages
6. **Submit** a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

If you find this plugin helpful, consider supporting its development:

[![Buy Me a Coffee](https://img.shields.io/badge/Buy%20Me%20a%20Coffee-ffdd00?style=for-the-badge&logo=buy-me-a-coffee&logoColor=black)](https://buymeacoffee.com/babylondreams)
[![Ko-fi](https://img.shields.io/badge/Ko--fi-F16061?style=for-the-badge&logo=ko-fi&logoColor=white)](https://ko-fi.com/babylondreams)
[![Patreon](https://img.shields.io/badge/Patreon-F96854?style=for-the-badge&logo=patreon&logoColor=white)](https://patreon.com/babylondreams)

## Contact

**Author**: Alexander Kucera
**Website**: [alexanderkucera.com](https://alexanderkucera.com)
**GitHub**: [@AlexKucera](https://github.com/AlexKucera)

---

*Happy writing! 📝✨*