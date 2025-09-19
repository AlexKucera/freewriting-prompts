# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is an Obsidian plugin project built with TypeScript. The plugin demonstrates core Obsidian API functionality including:
- Ribbon icons and status bar items
- Commands and editor commands
- Modal dialogs
- Settings tabs
- Event handling and intervals

## Development Commands

### Build and Development
- `npm run dev` - Start development mode with file watching (uses esbuild)
- `npm run build` - Production build with TypeScript checking and bundling
- `npm run version` - Bump version and update manifest/versions files

### Code Quality
- `eslint main.ts` - Lint the main TypeScript file
- `eslint ./src/` - Lint all files in src directory (if using src folder structure)

## Architecture

### Core Files
- `main.ts` - Main plugin entry point with all plugin logic
- `manifest.json` - Plugin metadata and Obsidian compatibility info
- `package.json` - npm dependencies and scripts
- `esbuild.config.mjs` - Build configuration using esbuild
- `tsconfig.json` - TypeScript compiler configuration

### Plugin Structure
The plugin follows the standard Obsidian plugin pattern:
- Main plugin class extends `Plugin` from obsidian
- Settings interface with default values
- Modal and SettingTab classes for UI components
- Event registration and cleanup handled by Obsidian framework

### Build Process
- Uses esbuild for fast bundling with watch mode in development
- TypeScript compilation with strict null checks enabled
- Externals include obsidian, electron, and CodeMirror modules
- Output: bundled `main.js` file for distribution

### Testing and Installation
- Manual installation: Copy `main.js`, `styles.css`, `manifest.json` to vault's `.obsidian/plugins/plugin-id/`
- For development: Place entire folder in `.obsidian/plugins/` and enable in settings
- Requires NodeJS v16+ for development

## Development Workflow
1. Run `npm i` to install dependencies
2. Use `npm run dev` for development with auto-rebuilding
3. Reload Obsidian to test changes
4. Enable plugin in Obsidian settings