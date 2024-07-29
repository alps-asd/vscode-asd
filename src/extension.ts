import * as path from 'path';
import * as vscode from 'vscode';
import {ExtensionContext, workspace} from 'vscode';
import * as fs from 'fs';

import {LanguageClient, LanguageClientOptions, ServerOptions, TransportKind} from 'vscode-languageclient/node';
import {renderAsd} from "./renderAsd";

let client: LanguageClient;

export function activate(context: ExtensionContext) {
    // Register the command to render ASD
    let renderAsdDisposable = vscode.commands.registerCommand('extension.renderAsd', () => {
        const editor = vscode.window.activeTextEditor;
        if (editor) {
            const document = editor.document;
            if (document.languageId === 'alps-xml' || document.fileName.endsWith('.alps.xml')) {
                renderAsd(document.fileName, context.extensionPath);
            } else {
                vscode.window.showInformationMessage('Please open an ALPS XML file (.alps.xml) to render preview.');
            }
        }
    });

    context.subscriptions.push(renderAsdDisposable);

    // Register the command to create a new ALPS file
    let createAlpsFileDisposable = vscode.commands.registerCommand('extension.createAlpsFile', createAlpsFile);
    context.subscriptions.push(createAlpsFileDisposable);

    // Automatically set language mode for .alps.xml files
    workspace.onDidOpenTextDocument((document) => {
        if (document.fileName.endsWith('.alps.xml')) {
            vscode.languages.setTextDocumentLanguage(document, 'alps-xml');
        }
    });

    const serverModule = context.asAbsolutePath(
        path.join('out', 'server.js')
    );
    const debugOptions = { execArgv: ['--nolazy', '--inspect=6009'] };

    const serverOptions: ServerOptions = {
        run: { module: serverModule, transport: TransportKind.ipc },
        debug: {
            module: serverModule,
            transport: TransportKind.ipc,
            options: debugOptions
        }
    };

    const clientOptions: LanguageClientOptions = {
        documentSelector: [
            { scheme: 'file', language: 'alps-xml' },
            { scheme: 'file', pattern: '**/*.alps.xml' }
        ],
        synchronize: {
            fileEvents: workspace.createFileSystemWatcher('**/*.alps.xml')
        }
    };

    client = new LanguageClient(
        'alpsLanguageServer',
        'ALPS Language Server',
        serverOptions,
        clientOptions
    );

    client.start();
}

async function createAlpsFile() {
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

export function deactivate(): Thenable<void> | undefined {
    if (!client) {
        return undefined;
    }
    return client.stop();
}
