import * as vscode from 'vscode';
import * as child_process from 'child_process';
import * as path from 'path';

export function activate(context: vscode.ExtensionContext) {
    console.log('ALPS profile renderer is now active');

    let disposable = vscode.commands.registerCommand('extension.renderAsd', () => {
        const editor = vscode.window.activeTextEditor;
        if (editor) {
            const document = editor.document;
            if (document.languageId === 'xml' || document.languageId === 'json') {
                renderAsd(document.fileName);
            } else {
                vscode.window.showInformationMessage('Please open an ALPS profile to render.');
            }
        }
    });

    context.subscriptions.push(disposable);

    // ファイル変更を監視
    const watcher = vscode.workspace.createFileSystemWatcher('**/*.{xml,json}');
    watcher.onDidChange((uri) => {
        // todo: quick validate as JSON or XML
        renderAsd(uri.fsPath);
    });
    context.subscriptions.push(watcher);
}

function renderAsd(filePath: string) {
    const fileExtension = path.extname(filePath);
    const htmlPath = path.join(path.dirname(filePath), path.basename(filePath, fileExtension) + '.html');

    child_process.exec(`/Users/akihito/git/app-state-diagram/bin/asd -e ${filePath}`, (error, stdout, stderr) => {
        if (error) {
            console.log(error.message);
            vscode.window.showErrorMessage(`${error.message}: Error rendering ALPS profile`);
            return;
        }

        // HTMLをWebviewで表示
        const panel = vscode.window.createWebviewPanel(
            'alpsRenderer',
            'App State Diagram',
            vscode.ViewColumn.Beside,
            {
                enableScripts: true,
                localResourceRoots: [vscode.Uri.file(path.dirname(filePath))]
            }
        );

        // HTMLコンテンツを調整
        let htmlContent = stdout
            .replace('<head>', `<head>
                <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${panel.webview.cspSource} https:; script-src ${panel.webview.cspSource} https: 'unsafe-inline' 'unsafe-eval'; style-src ${panel.webview.cspSource} https: 'unsafe-inline'; font-src ${panel.webview.cspSource} https:;">
                <base href="${panel.webview.asWebviewUri(vscode.Uri.file(path.dirname(filePath)))}/"/>`)
            .replace(/(src|href)="(.+?)"/g, (match, attr, value) => {
                if (value.startsWith('http')) {
                    return match; // 外部リソースはそのまま
                }
                const resourcePath = vscode.Uri.file(path.join(path.dirname(filePath), value));
                return `${attr}="${panel.webview.asWebviewUri(resourcePath)}"`;
            });

        panel.webview.html = htmlContent;
    });
}

export function deactivate() {}
