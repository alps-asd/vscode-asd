import * as vscode from 'vscode';
import * as child_process from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

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

    const watcher = vscode.workspace.createFileSystemWatcher('**/*.{xml,json}');
    watcher.onDidChange((uri) => {
        renderAsd(uri.fsPath);
    });
    context.subscriptions.push(watcher);
}

function renderAsd(filePath: string) {
    const fileExtension = path.extname(filePath);

    child_process.exec(`/Users/akihito/git/app-state-diagram/bin/asd -e ${filePath}`, (error, stdout, stderr) => {
        if (error) {
            console.log(error.message);
            vscode.window.showErrorMessage(`${error.message}: Error rendering ALPS profile`);
            return;
        }

        const panel = vscode.window.createWebviewPanel(
            'alpsRenderer',
            'App State Diagram',
            vscode.ViewColumn.Beside,
            {
                enableScripts: true,
                localResourceRoots: [vscode.Uri.file(path.dirname(filePath))]
            }
        );

        // CSPの設定を調整
        const csp = `<meta http-equiv="Content-Security-Policy" content="
            default-src 'self' ${panel.webview.cspSource};
            img-src 'self' ${panel.webview.cspSource} https: data:;
            script-src 'self' ${panel.webview.cspSource} https: 'unsafe-inline' 'unsafe-eval';
            style-src 'self' ${panel.webview.cspSource} https: 'unsafe-inline';
            font-src 'self' ${panel.webview.cspSource} https:;
            connect-src 'self' ${panel.webview.cspSource} https:;
        ">`;

        let htmlContent = stdout.replace('<head>', `<head>${csp}<base href="${panel.webview.asWebviewUri(vscode.Uri.file(path.dirname(filePath)))}/"/>`);

        // Webview 内でのパスの調整
        htmlContent = htmlContent.replace(/(src|href)="(.+?)"/g, (match, attr, value) => {
            if (value.startsWith('http')) {
                return match; // 外部リソースはそのまま
            }
            const resourcePath = vscode.Uri.file(path.join(path.dirname(filePath), value));
            return `${attr}="${panel.webview.asWebviewUri(resourcePath)}"`;
        });

        // デバッグ用のHTMLファイルを生成
        const debugFilePath = path.join(path.dirname(filePath), 'index_debug.html');
        fs.writeFileSync(debugFilePath, htmlContent);

        panel.webview.html = htmlContent;
    });
}

export function deactivate() {}
