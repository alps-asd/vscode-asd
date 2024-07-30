import * as vscode from 'vscode';
import * as path from 'path';
import {ExtensionContext, workspace} from 'vscode';
import {LanguageClient, LanguageClientOptions, ServerOptions, TransportKind} from 'vscode-languageclient/node';
import {renderAsd} from "./renderAsd";
import {createAlpsFile} from "./createAlpsFile";

let client: LanguageClient;
let fileWatchers: Map<string, vscode.FileSystemWatcher> = new Map();

export function activate(context: ExtensionContext) {
    // Register the command to render ASD
    let renderAsdDisposable = vscode.commands.registerCommand('extension.renderAsd', async (uri?: vscode.Uri) => {
        const editor = vscode.window.activeTextEditor;
        if (editor || uri) {
            const document = uri ? await vscode.workspace.openTextDocument(uri) : editor!.document;
            renderAsd(document.fileName, context.extensionPath);
            // 新しいファイルウォッチャーを作成
            createFileWatcher(document.fileName);
        } else {
            vscode.window.showInformationMessage('No active document to render ALPS preview.');
        }
    });

    context.subscriptions.push(renderAsdDisposable);

    // Register the command to create a new ALPS file
    let createAlpsFileDisposable = vscode.commands.registerCommand('extension.createAlpsFile', createAlpsFile);
    context.subscriptions.push(createAlpsFileDisposable);

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
            { scheme: 'file', pattern: '**/*.alps.xml' },
            { scheme: 'file', pattern: '**/*.alps.json' }
        ],
        synchronize: {
            // ファイルウォッチャーは動的に管理するため、ここでは指定しない
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

function createFileWatcher(filePath: string) {
    if (fileWatchers.has(filePath)) {
        return; // 既にウォッチャーが存在する場合は何もしない
    }

    const watcher = workspace.createFileSystemWatcher(filePath);
    watcher.onDidChange(() => {
        // ファイルが変更されたときの処理
        vscode.commands.executeCommand('extension.renderAsd', vscode.Uri.file(filePath));
    });

    fileWatchers.set(filePath, watcher);
}

export function deactivate(): Thenable<void> | undefined {
    // ファイルウォッチャーをクリーンアップ
    fileWatchers.forEach(watcher => watcher.dispose());
    fileWatchers.clear();

    if (!client) {
        return undefined;
    }
    return client.stop();
}
