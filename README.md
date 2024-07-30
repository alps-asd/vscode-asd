# Application State Diagram for VS Code

Enhance your ALPS (Application-Level Profile Semantics) in Visual Studio Code with real-time visualization and editing support.

VSCodeでALPS（Application-Level Profile Semantics）をリアルタイムの視覚化し、編集時の補完を強化します。

## Features / 機能

- **Live ASD Preview / リアルタイムASDプレビュー:**
  Visualize your ALPS profile as an Application State Diagram in real-time.
  ALPSプロファイルをアプリケーション状態図としてリアルタイムで視覚化します。

- **Side-by-side Viewing / サイドバイサイド表示:**
  Edit your ALPS file and instantly see the updated diagram.
  ALPSファイルを編集し、更新された図を即座に確認できます。

- **Format Support / フォーマットサポート:**
  Compatible with both XML and JSON ALPS formats.
  XMLとJSON両方のALPSフォーマットに対応しています。

- **Auto-refresh / 自動更新:**
  Preview updates automatically as you modify the ALPS file.
  ALPSファイルを変更すると、プレビューが自動的に更新されます。

- **Enhanced Code Completion / 強化されたコード補完:**
  Detailed ALPS-specific code completion now available.
  ALPS固有の詳細なコード補完が利用可能になりました。

- **Syntax Highlighting / シンタックスハイライト:**
  ALPS XML language mode for improved readability.
  読みやすさを向上させるALPS XML言語モードを提供します。

- **Easy File Creation / 簡単なファイル作成:**
  Create new ALPS files with proper structure using the "Create New ALPS File" command.
  "Create New ALPS File"コマンドを使用して、適切な構造の新しいALPSファイルを簡単に作成できます。

## File Extensions / ファイル拡張子

- `.alps.xml`: Automatically recognized as ALPS XML files.
- `.alps.json`: Automatically recognized as ALPS JSON files. (not supported yet)

これらの拡張子を持つファイルは自動的にALPSファイルとして認識されます。

## Requirements / 必要条件

- Visual Studio Code version 1.60.0 or higher
- ALPS profile files (XML or JSON)
- The `asd` command-line tool available in your system PATH

## Installation / インストール

1. Install the extension from the Visual Studio Code Marketplace.
   VS Code マーケットプレイスから拡張機能をインストールします。

2. Ensure the `asd` tool is installed and accessible in your system PATH.
   `asd`ツールがインストールされ、システムPATHからアクセス可能であることを確認してください。

## Usage / 使用方法

1. Open an ALPS profile (XML or JSON) in VS Code.
   VS CodeでALPSプロファイル（XMLまたはJSON）を開きます。

2. Activate the visual preview:
   ビジュアルプレビューを有効にします：
   - Use the Command Palette (Ctrl+Shift+P or Cmd+Shift+P) and search for "Open ALPS Visual Preview"
   - Or click the "Open ALPS Preview" icon in the editor title area

3. Edit your ALPS file and observe the diagram updating in real-time.
   ALPSファイルを編集し、図がリアルタイムで更新されることを確認します。

The visual preview opens in a side panel, allowing simultaneous editing and visualization.
ビジュアルプレビューはサイドパネルで開かれ、同時に編集と視覚化が可能です。
