import * as vscode from 'vscode';
import * as path from 'path';

const ALPS_TEMPLATE = `<?xml version="1.0" encoding="UTF-8"?>
<alps
  version="1.0"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:noNamespaceSchemaLocation="https://alps-io.github.io/schemas/alps.xsd">

</alps>`;

const CURSOR_LINE = 5;
const CURSOR_COLUMN = 2;

function getDefaultFileUri(): vscode.Uri | undefined {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (workspaceFolder) {
        return vscode.Uri.file(path.join(workspaceFolder.uri.fsPath, 'alps.xml'));
    }
    return undefined;
}

export async function createAlpsFile(): Promise<void> {
    try {
        const savedFileUri = await vscode.window.showSaveDialog({
            defaultUri: getDefaultFileUri(),
            filters: {
                'ALPS XML Files': ['alps.xml'],
                'All Files': ['*']
            },
            saveLabel: 'Create ALPS File'
        });

        if (!savedFileUri) {
            vscode.window.showInformationMessage('ALPS file creation cancelled.');
            return;
        }

        await vscode.workspace.fs.writeFile(
            savedFileUri,
            Buffer.from(ALPS_TEMPLATE, 'utf8')
        );

        const document = await vscode.workspace.openTextDocument(savedFileUri);
        const editor = await vscode.window.showTextDocument(document);

        const position = new vscode.Position(CURSOR_LINE, CURSOR_COLUMN);
        editor.selection = new vscode.Selection(position, position);

        vscode.window.showInformationMessage(
            'New ALPS file created and saved. You can now start editing.'
        );
    } catch (error) {
        vscode.window.showErrorMessage(`Failed to create ALPS file: ${error}`);
    }
}
