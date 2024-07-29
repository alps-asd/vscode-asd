こちらが更新されたREADMEです。追加された機能を反映しました。

---

# Application State Diagram for VS Code

Enhance your ALPS (Application-Level Profile Semantics) workflow in Visual Studio Code with real-time visualization and editing support.

## Features

- **Live ASD Preview:** Visualize your ALPS profile as an Application State Diagram in real-time
- **Side-by-side Viewing:** Edit your ALPS file and instantly see the updated diagram
- **Format Support:** Compatible with both XML and JSON ALPS formats
- **Auto-refresh:** Preview updates automatically as you modify the ALPS file
- **Detailed ALPS-specific Code Completion:** Enhanced code completion for ALPS profiles, now available
- **Syntax Highlighting for ALPS Profiles:** Choose the ALPS XML language mode for XML files. Files with the `.alpx.xml` extension automatically select this mode.

## Upcoming Features

- Quick navigation between ALPS elements and their visual representations

## Requirements

- Visual Studio Code version 1.60.0 or higher
- ALPS profile files (XML or JSON)
- The `asd` command-line tool available in your system PATH

## Installation

1. Install the plug-in from the Visual Studio Code Marketplace
2. Ensure the `asd` tool is installed and accessible in your system PATH

## Usage

1. Open an ALPS profile (XML or JSON) in VS Code
2. Activate the visual preview:
   - Use the Command Palette (Ctrl+Shift+P or Cmd+Shift+P) and search for "Open ALPS Visual Preview"
   - Or click the "Open ALPS Preview" icon in the editor title area
3. Edit your ALPS file and observe the diagram updating in real-time

The visual preview opens in a side panel, allowing simultaneous editing and visualization.

## Additional Features

- **Create New ALPS File:** Easily start a new ALPS file using the "Create New ALPS File" command available in the Command Palette.
