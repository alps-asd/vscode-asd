# Application State Diagram for VS Code

Enhance your ALPS (Application-Level Profile Semantics) in Visual Studio Code with real-time visualization and editing support.

## Features

- **Live ASD Preview:** Visualize ALPS profiles as Application State Diagrams in real-time
- **Side-by-side Viewing:** Edit ALPS files with instant diagram updates
- **Enhanced Code Completion:** ALPS-specific code suggestions
- **Syntax Highlighting:** Improved readability with ALPS XML language mode
- **Easy File Creation:** Create new ALPS files using the "Create New ALPS File" command

## Usage

1. Create a new ALPS file:
    - Open the Command Palette (Ctrl+Shift+P or Cmd+Shift+P)
    - Search for and select "Create New ALPS File"
    - Choose a location and name for your new file

2. Open an existing ALPS XML file in VS Code.

3. Set the language mode to ALPS XML:
    - Click the language mode indicator in the bottom-right corner
    - Select "ALPS XML" from the list
      Or:
    - Open the Command Palette (Ctrl+Shift+P or Cmd+Shift+P)
    - Type "Change Language Mode" and select it
    - Choose "ALPS XML"

4. Activate the visual preview:
    - Use the Command Palette and search for "Open ALPS Visual Preview"
    - Or click the "Open ALPS Preview" icon in the editor title area

5. Edit your ALPS file and see real-time diagram updates.

Note: Files with the .alps.xml extension automatically use the ALPS XML language mode.

## File Extensions

- `.alps.xml`: Automatically recognized as ALPS XML files
- `.alps.json`: Automatically recognized as ALPS JSON files (not supported yet)

## Requirements

- Visual Studio Code version 1.60.0 or higher
- ALPS profile files (XML)
- The `asd` command-line tool in your system PATH

## Installation

For installation instructions, please refer to:
https://marketplace.visualstudio.com/items?itemName=koriym.app-state-diagram

---
## 機能


- **リアルタイムASDプレビュー:** ALPSプロファイルをアプリケーション状態図としてリアルタイムで表示
- **サイドバイサイド表示:** ALPSファイルの編集と即時の図の更新
- **強化されたコード補完:** ALPS固有のコード提案
- **シンタックスハイライト:** ALPS XML言語モードによる読みやすさの向上
- **簡単なファイル作成:** "Create New ALPS File"コマンドで新規ALPSファイルを作成

## 使用方法

1. 新しいALPSファイルを作成：
    - コマンドパレット（Ctrl+Shift+PまたはCmd+Shift+P）を開く
    - "Create New ALPS File"を検索して選択
    - 新しいファイルの保存場所と名前を選択

2. 既存のALPS XMLファイルをVS Codeで開きます。

3. 言語モードをALPS XMLに設定：
    - 右下の言語モード表示をクリック
    - リストから"ALPS XML"を選択
      または：
    - コマンドパレットを開く
    - "Change Language Mode"と入力して選択
    - "ALPS XML"を選択

4. ビジュアルプレビューを有効化：
    - コマンドパレットで"Open ALPS Visual Preview"を検索
    - またはエディタのタイトル領域の"Open ALPS Preview"アイコンをクリック

5. ALPSファイルを編集し、リアルタイムで図の更新を確認。

注意：.alps.xml拡張子のファイルは自動的にALPS XML言語モードを使用します。

## ファイル拡張子

- `.alps.xml`: ALPS XMLファイルとして自動認識
- `.alps.json`: ALPS JSONファイルとして自動認識（現在未対応）

## インストール

インストール手順については、以下をご参照ください：
https://marketplace.visualstudio.com/items?itemName=koriym.app-state-diagram
