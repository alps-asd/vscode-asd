import vscode from "vscode";
import path from "path";
import fs from "fs";

export async function createAlpsFile() {
    const wsPath = vscode.workspace.workspaceFolders?.[0].uri.fsPath;
    if (!wsPath) {
        vscode.window.showErrorMessage('No workspace folder open');
        return;
    }

    const filePath = await vscode.window.showInputBox({
        prompt: 'Enter file name',
        value: 'new_alps_profile.alps.xml'
    });

    if (filePath) {
        const fullPath = path.join(wsPath, filePath);
        const content = `<?xml version="1.0" encoding="UTF-8"?>
<alps
    xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
    xsi:noNamespaceSchemaLocation="https://alps-io.github.io/schemas/alps.xsd">
</alps>`;
        fs.writeFileSync(fullPath, content);
        const doc = await vscode.workspace.openTextDocument(fullPath);
        await vscode.window.showTextDocument(doc);
        // No need to explicitly set language mode as it will be automatically set by the file watcher
    }
}
