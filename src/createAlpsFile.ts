import * as vscode from 'vscode';

export async function createAlpsFile() {
    try {
        // Create a new untitled document
        const newFile = await vscode.workspace.openTextDocument({
            language: 'alps-xml',
            content: '<?xml version="1.0" encoding="UTF-8"?>\n<alps version="1.0">\n    \n</alps>'
        });

        // Show the new document
        const editor = await vscode.window.showTextDocument(newFile);

        // Set the cursor position inside the <alps> tags
        const position = new vscode.Position(2, 4);
        editor.selection = new vscode.Selection(position, position);

        // Optionally, you can show a message to remind the user to save with .alps.xml extension
        vscode.window.showInformationMessage('Remember to save the file with .alps.xml extension');

    } catch (error) {
        vscode.window.showErrorMessage(`Failed to create ALPS file: ${error}`);
    }
}