import * as vscode from 'vscode';
import * as path from 'path';

export async function createAlpsFile() {
    try {
        // Create initial content for the ALPS file
        const initialContent = '<?xml version="1.0" encoding="UTF-8"?>\n' +
            '<alps \n' +
            '  version="1.0"\n' +
            '  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"\n' +
            '  xsi:noNamespaceSchemaLocation="https://alps-io.github.io/schemas/alps.xsd">\n' +
            '  \n' +
            '</alps>';

        // Get the current workspace folder
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        const defaultUri = workspaceFolder
            ? vscode.Uri.file(path.join(workspaceFolder.uri.fsPath, 'alps.xml'))
            : undefined;

        // Show save dialog with default name
        const savedFileUri = await vscode.window.showSaveDialog({
            defaultUri: defaultUri,
            filters: {
                'ALPS XML Files': ['alps.xml'],
                'All Files': ['*']
            },
            saveLabel: 'Create ALPS File'
        });

        if (savedFileUri) {
            // Write the initial content to the file
            await vscode.workspace.fs.writeFile(savedFileUri, Buffer.from(initialContent, 'utf8'));

            // Open the saved file
            const document = await vscode.workspace.openTextDocument(savedFileUri);
            const editor = await vscode.window.showTextDocument(document);

            // Set the cursor position inside the <alps> tags
            const position = new vscode.Position(5, 2);
            editor.selection = new vscode.Selection(position, position);

            vscode.window.showInformationMessage('New ALPS file created and saved. You can now start editing.');
        } else {
            vscode.window.showInformationMessage('ALPS file creation cancelled.');
        }

    } catch (error) {
        vscode.window.showErrorMessage(`Failed to create ALPS file: ${error}`);
    }
}
