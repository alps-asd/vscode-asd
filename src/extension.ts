import * as path from 'path';
import * as vscode from 'vscode';
import {ExtensionContext, workspace} from 'vscode';

import {LanguageClient, LanguageClientOptions, ServerOptions, TransportKind} from 'vscode-languageclient/node';
import {renderAsd} from "./renderAsd";
import {createAlpsFile} from "./createAlpsFile";

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

export function deactivate(): Thenable<void> | undefined {
    if (!client) {
        return undefined;
    }
    return client.stop();
}
