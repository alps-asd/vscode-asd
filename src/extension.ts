import * as vscode from 'vscode';
import * as path from 'path';
import { ExtensionContext, workspace, CancellationToken, CompletionContext } from 'vscode';
import { LanguageClient, LanguageClientOptions, ServerOptions, TransportKind } from 'vscode-languageclient/node';
import { renderAsd } from './renderAsd';
import { createAlpsFile } from './createAlpsFile';

let client: LanguageClient;
const fileWatchers: Map<string, vscode.FileSystemWatcher> = new Map();
let outputChannel: vscode.OutputChannel;

function createFileWatcher(filePath: string): void {
    if (fileWatchers.has(filePath)) {
        return;
    }

    const watcher = workspace.createFileSystemWatcher(filePath);
    watcher.onDidChange(() => {
        vscode.commands.executeCommand('extension.renderAsd', vscode.Uri.file(filePath));
    });

    fileWatchers.set(filePath, watcher);
}

function registerCommands(context: ExtensionContext): void {
    const renderAsdDisposable = vscode.commands.registerCommand(
        'extension.renderAsd',
        async (uri?: vscode.Uri) => {
            const editor = vscode.window.activeTextEditor;
            if (editor || uri) {
                const document = uri
                    ? await vscode.workspace.openTextDocument(uri)
                    : editor!.document;
                renderAsd(document.fileName, context.extensionPath);
                createFileWatcher(document.fileName);
            } else {
                vscode.window.showInformationMessage('No active document to render ALPS preview.');
            }
        }
    );

    const createAlpsFileDisposable = vscode.commands.registerCommand(
        'extension.createAlpsFile',
        createAlpsFile
    );

    context.subscriptions.push(renderAsdDisposable, createAlpsFileDisposable);
}

function createLanguageClient(context: ExtensionContext): LanguageClient {
    const serverModule = context.asAbsolutePath(path.join('out', 'server.js'));
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
        synchronize: {},
        outputChannel: outputChannel
    };

    return new LanguageClient(
        'alpsLanguageServer',
        'ALPS Language Server',
        serverOptions,
        clientOptions
    );
}

function registerCompletionProvider(context: ExtensionContext): void {
    const provider = vscode.languages.registerCompletionItemProvider(
        [{ language: 'json', pattern: '**/*.alps.json' }],
        {
            provideCompletionItems(
                document: vscode.TextDocument,
                position: vscode.Position,
                token: CancellationToken,
                context: CompletionContext
            ): vscode.ProviderResult<vscode.CompletionItem[] | vscode.CompletionList> {
                const linePrefix = document.lineAt(position).text.substring(0, position.character);
                outputChannel.appendLine(`Completion triggered. Line prefix: ${linePrefix}`);
                outputChannel.appendLine(`Trigger kind: ${context.triggerKind}, character: ${context.triggerCharacter}`);

                if (context.triggerCharacter === ',') {
                    outputChannel.appendLine('Comma detected, sending completion request to server');
                    return client.sendRequest<vscode.CompletionList | vscode.CompletionItem[] | null>(
                        'textDocument/completion',
                        {
                            textDocument: { uri: document.uri.toString() },
                            position: position,
                            context: {
                                triggerKind: context.triggerKind,
                                triggerCharacter: context.triggerCharacter
                            }
                        }
                    ).then(
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
        ','
    );

    context.subscriptions.push(provider);
}

function registerDocumentChangeListener(): void {
    vscode.workspace.onDidChangeTextDocument((event) => {
        if (event.contentChanges.length > 0 && event.contentChanges[0].text === ',') {
            outputChannel.appendLine('Comma typed. Triggering completion...');
            vscode.commands.executeCommand('editor.action.triggerSuggest');
        }
    });
}

export function activate(context: ExtensionContext): void {
    outputChannel = vscode.window.createOutputChannel('ALPS Extension');
    outputChannel.appendLine('ALPS extension activated');

    registerCommands(context);

    client = createLanguageClient(context);
    client.start();

    registerCompletionProvider(context);
    registerDocumentChangeListener();

    outputChannel.appendLine('ALPS extension setup completed');
}

export function deactivate(): Thenable<void> | undefined {
    outputChannel.appendLine('Deactivating ALPS extension');

    fileWatchers.forEach((watcher) => watcher.dispose());
    fileWatchers.clear();

    if (!client) {
        return undefined;
    }
    return client.stop();
}
