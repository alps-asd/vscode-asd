import * as path from 'path';
import * as vscode from 'vscode';
import * as child_process from 'child_process';
import * as fs from 'fs';
import { workspace, ExtensionContext } from 'vscode';

import {
    LanguageClient,
    LanguageClientOptions,
    ServerOptions,
    TransportKind
} from 'vscode-languageclient/node';

let client: LanguageClient;
let alpsStatusBarItem: vscode.StatusBarItem;

export function activate(context: ExtensionContext) {
    // Register the command to render ASD
    let disposable = vscode.commands.registerCommand('extension.renderAsd', () => {
        const editor = vscode.window.activeTextEditor;
        if (editor) {
            const document = editor.document;
            if (document.languageId === 'alps-xml' && isAlpsDocument(document.getText())) {
                renderAsd(document.fileName, context.extensionPath);
            } else {
                vscode.window.showInformationMessage('Please open a valid ALPS XML file to render preview.');
            }
        }
    });

    context.subscriptions.push(disposable);

    // Register the command to create a new ALPS file
    let createAlpsFileDisposable = vscode.commands.registerCommand('extension.createAlpsFile', createAlpsFile);
    context.subscriptions.push(createAlpsFileDisposable);

    // Create status bar item
    alpsStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    context.subscriptions.push(alpsStatusBarItem);

    // The shared file watcher
    const watcher = vscode.workspace.createFileSystemWatcher('**/*.xml');
    watcher.onDidChange((uri) => {
        checkAndUpdateAlpsStatus(uri);
    });

    context.subscriptions.push(watcher);

    // Check ALPS status when a text document is opened or changed
    vscode.workspace.onDidOpenTextDocument(checkAndUpdateAlpsStatus);
    vscode.workspace.onDidChangeTextDocument((event) => checkAndUpdateAlpsStatus(event.document.uri));

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
        documentSelector: [{ scheme: 'file', language: 'alps-xml' }],
        synchronize: {
            fileEvents: watcher
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

function isAlpsDocument(content: string): boolean {
    const alpsTagRegex = /^\s*<alps\s+[^>]*>/m;
    return alpsTagRegex.test(content);
}

function checkAndUpdateAlpsStatus(uri: vscode.Uri) {
    vscode.workspace.openTextDocument(uri).then(document => {
        if (document.languageId === 'alps-xml') {
            const isAlps = isAlpsDocument(document.getText());
            updateAlpsStatus(document, isAlps);
        }
    });
}

function updateAlpsStatus(document: vscode.TextDocument, isAlps: boolean) {
    if (isAlps) {
        alpsStatusBarItem.text = "ALPS Document";
        alpsStatusBarItem.show();
    } else {
        alpsStatusBarItem.hide();
    }
}

async function createAlpsFile() {
    const wsPath = vscode.workspace.workspaceFolders?.[0].uri.fsPath;
    if (!wsPath) {
        vscode.window.showErrorMessage('No workspace folder open');
        return;
    }

    const filePath = await vscode.window.showInputBox({
        prompt: 'Enter file name',
        value: 'new_alps_profile.xml'
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
    }
}

function renderAsd(filePath: string, extensionPath: string) {
    const pharPath = path.join(extensionPath, 'asd.phar');
    const command = `php "${pharPath}" -e "${filePath}"`;

    child_process.exec(command, (error, stdout, stderr) => {
        if (error) {
            console.log(error.message);
            vscode.window.showErrorMessage(`${error.message}: Error rendering ALPS profile`);
            return;
        }

        // Create a new webview panel
        const panel = vscode.window.createWebviewPanel(
            'alpsRenderer',
            'App State Diagram',
            vscode.ViewColumn.Beside,
            {
                enableScripts: true,
                localResourceRoots: [vscode.Uri.file(path.dirname(filePath))]
            }
        );

        // Define Content Security Policy
        const csp = `<meta http-equiv="Content-Security-Policy" content="
            default-src 'self' ${panel.webview.cspSource};
            img-src 'self' ${panel.webview.cspSource} https: data:;
            script-src 'self' ${panel.webview.cspSource} https: 'unsafe-inline' 'unsafe-eval' blob:;
            style-src 'self' ${panel.webview.cspSource} https: 'unsafe-inline';
            font-src 'self' ${panel.webview.cspSource} https: data:;
            connect-src 'self' ${panel.webview.cspSource} https:;
            worker-src 'self' blob:;
        ">`;

        // Inject CSP and base href into the HTML content
        let htmlContent = stdout.replace('<head>', `<head>${csp}<base href="${panel.webview.asWebviewUri(vscode.Uri.file(path.dirname(filePath)))}/"/>`);

        // Adjust paths for webview
        htmlContent = htmlContent.replace(/(src|href)="(.+?)"/g, (match, attr, value) => {
            if (value.startsWith('http')) {
                return match; // Keep external resources as is
            }
            const resourcePath = vscode.Uri.file(path.join(path.dirname(filePath), value));
            return `${attr}="${panel.webview.asWebviewUri(resourcePath)}"`;
        });

        // Set the webview's HTML content
        panel.webview.html = htmlContent;
    });
}

export function deactivate(): Thenable<void> | undefined {
    if (!client) {
        return undefined;
    }
    return client.stop();
}
