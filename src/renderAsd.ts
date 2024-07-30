import * as vscode from 'vscode';
import * as path from 'path';
import * as child_process from 'child_process';

interface ParsedError {
    type: 'InvalidXml' | 'DescriptorNotFound' | 'Unknown';
    message: string;
    line?: number;
    descriptorId?: string;
}

function parseErrorMessage(errorMessage: string): ParsedError {
    const invalidXmlMatch = errorMessage.match(/InvalidXmlException\((.+?) in .+?:(\d+)\)/);
    if (invalidXmlMatch) {
        return {
            type: 'InvalidXml',
            message: invalidXmlMatch[1],
            line: parseInt(invalidXmlMatch[2], 10)
        };
    }

    const descriptorNotFoundMatch = errorMessage.match(/DescriptorNotFoundException\((.+?)\)/);
    if (descriptorNotFoundMatch) {
        return {
            type: 'DescriptorNotFound',
            message: `Descriptor not found: ${descriptorNotFoundMatch[1]}`,
            descriptorId: descriptorNotFoundMatch[1]
        };
    }

    return {
        type: 'Unknown',
        message: errorMessage
    };
}

async function findDescriptorReference(document: vscode.TextDocument, descriptorId: string): Promise<vscode.Position | null> {
    const text = document.getText();
    const searchPattern = `="#${descriptorId}"`;
    const index = text.indexOf(searchPattern);
    if (index !== -1) {
        return document.positionAt(index);
    }
    return null;
}

async function showErrorMessage(error: string) {
    const parsedError = parseErrorMessage(error);
    const activeEditor = vscode.window.activeTextEditor;
    if (!activeEditor) {
        vscode.window.showErrorMessage(`Error rendering ALPS profile: ${parsedError.message}`);
        return;
    }

    switch (parsedError.type) {
        case 'InvalidXml':
            vscode.window.showErrorMessage(`Error on line ${parsedError.line}: ${parsedError.message}`, 'Go to Error').then(selection => {
                if (selection === 'Go to Error' && parsedError.line) {
                    const position = new vscode.Position(parsedError.line - 1, 0);
                    activeEditor.selection = new vscode.Selection(position, position);
                    activeEditor.revealRange(new vscode.Range(position, position));
                }
            });
            break;

        case 'DescriptorNotFound':
            const position = await findDescriptorReference(activeEditor.document, parsedError.descriptorId!);
            if (position) {
                vscode.window.showErrorMessage(parsedError.message, 'Go to Error').then(selection => {
                    if (selection === 'Go to Error') {
                        activeEditor.selection = new vscode.Selection(position, position);
                        activeEditor.revealRange(new vscode.Range(position, position));
                    }
                });
            } else {
                vscode.window.showErrorMessage(parsedError.message);
            }
            break;

        default:
            vscode.window.showErrorMessage(`Error rendering ALPS profile: ${parsedError.message}`);
    }
}

export function renderAsd(filePath: string, extensionPath: string) {
    const pharPath = path.join(extensionPath, 'asd.phar');
    const command = `php "${pharPath}" -e "${filePath}"`;

    child_process.exec(command, async (error, stdout, stderr) => {
        if (error) {
            console.log(error.message);
            await showErrorMessage(error.message);
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
