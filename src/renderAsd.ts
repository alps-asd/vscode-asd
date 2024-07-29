import path from "path";
import child_process from "child_process";
import vscode from "vscode";

export function renderAsd(filePath: string, extensionPath: string) {
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
