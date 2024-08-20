import * as vscode from 'vscode';
import * as path from 'path';
import {ExtensionContext, workspace, CancellationToken, CompletionContext} from 'vscode';
import {LanguageClient, LanguageClientOptions, ServerOptions, TransportKind} from 'vscode-languageclient/node';
import {renderAsd} from "./renderAsd";
import {createAlpsFile} from "./createAlpsFile";

let client: LanguageClient;
let fileWatchers: Map<string, vscode.FileSystemWatcher> = new Map();
let outputChannel: vscode.OutputChannel;

export function activate(context: ExtensionContext) {
    console.log('Activating ALPS extension');
    outputChannel = vscode.window.createOutputChannel("ALPS Extension");
    outputChannel.appendLine('ALPS extension activated');

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
        },
        outputChannel: outputChannel
    };

    client = new LanguageClient(
        'alpsLanguageServer',
        'ALPS Language Server',
        serverOptions,
        clientOptions
    );

    client.start();

    // Add comma trigger for completion using LSP
    context.subscriptions.push(
        vscode.languages.registerCompletionItemProvider(
            [{ language: 'json', pattern: '**/*.alps.json' }],
            {
                provideCompletionItems(
                    document: vscode.TextDocument,
                    position: vscode.Position,
                    token: CancellationToken,
                    context: CompletionContext
                ): vscode.ProviderResult<vscode.CompletionItem[] | vscode.CompletionList> {
                    const linePrefix = document.lineAt(position).text.substr(0, position.character);
                    outputChannel.appendLine(`Completion triggered. Line prefix: ${linePrefix}`);
                    outputChannel.appendLine(`Trigger kind: ${context.triggerKind}, character: ${context.triggerCharacter}`);

                    // Check if the completion was triggered by a comma
                    if (context.triggerCharacter === ',') {
                        outputChannel.appendLine('Comma detected, sending completion request to server');
                        // Trigger server-side completion
                        return client.sendRequest<vscode.CompletionList | vscode.CompletionItem[] | null>('textDocument/completion', {
                            textDocument: { uri: document.uri.toString() },
                            position: position,
                            context: {
                                triggerKind: context.triggerKind,
                                triggerCharacter: context.triggerCharacter
                            }
                        }).then(
                            (result) => {
                                outputChannel.appendLine(`Received completion result: ${JSON.stringify(result)}`);
                                return result;
                            },
                            (error) => {
                                outputChannel.appendLine(`Error in completion request: ${error}`);
                                return null;
                            }
                        );
                    }
                    return null;
                }
            },
            ','  // Specify comma as trigger character
        )
    );

    // Add an event listener for text document changes
    vscode.workspace.onDidChangeTextDocument((event) => {
        if (event.contentChanges.length > 0 && event.contentChanges[0].text === ',') {
            outputChannel.appendLine('Comma typed. Triggering completion...');
            vscode.commands.executeCommand('editor.action.triggerSuggest');
        }
    });

    outputChannel.appendLine('ALPS extension setup completed');
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
    outputChannel.appendLine('Deactivating ALPS extension');
    // ファイルウォッチャーをクリーンアップ
    fileWatchers.forEach(watcher => watcher.dispose());
    fileWatchers.clear();

    if (!client) {
        return undefined;
    }
    return client.stop();
}
