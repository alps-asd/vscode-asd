# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

This is a VS Code extension for ALPS (Application-Level Profile Semantics) that provides real-time visualization and editing support for ALPS profiles. ALPS is a specification for describing application-level semantics.

## Build Commands

```bash
npm run compile      # Compile TypeScript to JavaScript (output in ./out/)
npm run watch        # Watch mode compilation
npm run lint         # Run ESLint on src directory
npm run test         # Run tests (requires compile first)
npm run vscode:prepublish  # Prepare for publishing (runs compile)
```

## Development

To debug the extension in VS Code:
1. Press F5 or use "Run Extension" launch configuration
2. This opens a new Extension Development Host window
3. The extension auto-compiles via the `compile` pre-launch task

## Architecture

The extension uses a client-server architecture based on the Language Server Protocol (LSP):

**Client Side (extension.ts)**
- Registers VS Code commands (`extension.renderAsd`, `extension.createAlpsFile`)
- Starts the language server and manages its lifecycle
- Sets up file watchers for live preview updates
- Handles comma-triggered completion for JSON files

**Language Server (server.ts)**
- Runs as a separate Node.js process communicating via IPC
- Provides completions, validation, and diagnostics
- Routes to appropriate handlers based on language ID (`alps-xml` or `alps-json`)

**Key Modules**
- `alpsParser.ts` - Parses ALPS profiles from XML (using xml2js/sax) and JSON to extract descriptor information
- `completionItems.ts` - XML completion logic (tags, attributes, type/href/rt values)
- `jsonCompletion.ts` - JSON-specific completion handling
- `ImprovedXMLValidator.ts` - XML validation using SAX parser
- `jsonValidator.ts` - JSON validation using jsonc-parser
- `renderAsd.ts` - Renders ALPS as Application State Diagrams by invoking `asd.phar` via PHP

**External Dependency**
- `asd.phar` - PHP archive that generates HTML diagrams from ALPS files. Requires PHP in PATH.

## File Associations

- `.alps.xml` - ALPS XML (language ID: `alps-xml`)
- `.alps.json` - ALPS JSON (language ID: `alps-json`)
