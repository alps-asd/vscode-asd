import * as vscode from 'vscode';
import * as child_process from 'child_process';
import * as path from 'path';

export function activate(context: vscode.ExtensionContext) {
    console.log('XML to HTML renderer is now active');

    let disposable = vscode.commands.registerCommand('extension.renderXML', () => {
        const editor = vscode.window.activeTextEditor;
        if (editor) {
            const document = editor.document;
            if (document.languageId === 'xml') {
                renderXMLToHTML(document.fileName);
            } else {
                vscode.window.showInformationMessage('Please open an XML file to render.');
            }
        }
    });

    context.subscriptions.push(disposable);

    // ファイル変更を監視
    const watcher = vscode.workspace.createFileSystemWatcher('**/*.xml');
    watcher.onDidChange((uri) => {
        renderXMLToHTML(uri.fsPath);
    });
    context.subscriptions.push(watcher);
}

function renderXMLToHTML(filePath: string) {
    const htmlPath = path.join(path.dirname(filePath), path.basename(filePath, '.xml') + '.html');
    
    child_process.exec(`asd ${filePath}`, (error, stdout, stderr) => {
        if (error) {
            vscode.window.showErrorMessage(`Error rendering XML: ${error.message}`);
            return;
        }
        
        // 結果をHTMLファイルに書き込む
        vscode.workspace.fs.writeFile(vscode.Uri.file(htmlPath), Buffer.from(stdout));
        
        // HTMLをWebviewで表示
        const panel = vscode.window.createWebviewPanel(
            'xmlRenderer',
            'XML Rendered',
            vscode.ViewColumn.Beside,
            {}
        );
        panel.webview.html = stdout;
    });
}

export function deactivate() {}