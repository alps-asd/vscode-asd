import * as vscode from 'vscode';
import * as child_process from 'child_process';
import * as path from 'path';

/**
 * Activates the ALPS profile renderer extension.
 * 
 * @param context The extension context
 */
export function activate(context: vscode.ExtensionContext) {
    console.log('ALPS profile renderer is now active');

    // Register the command to render ASD
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

    // Watch for changes in XML and JSON files
    const watcher = vscode.workspace.createFileSystemWatcher('**/*.{xml,json}');
    watcher.onDidChange((uri) => {
        renderAsd(uri.fsPath);
    });
    context.subscriptions.push(watcher);
}

/**
 * Renders the ALPS State Diagram for the given file.
 * @param filePath The path of the file to render
 */
function renderAsd(filePath: string) {
    // Execute the ASD rendering command
    child_process.exec(`asd -e ${filePath}`, (error, stdout, stderr) => {
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

/**
 * Deactivates the extension.
 */
export function deactivate() {}