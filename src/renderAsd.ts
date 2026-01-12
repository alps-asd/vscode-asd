import * as vscode from 'vscode';
import * as path from 'path';
import * as child_process from 'child_process';

interface ParsedError {
    type: 'InvalidXml' | 'DescriptorNotFound' | 'ParsingException' | 'Unknown';
    message: string;
    line?: number;
    descriptorId?: string;
}

interface ErrorPattern {
    regex: RegExp;
    parse: (match: RegExpMatchArray) => ParsedError;
}

const ERROR_PATTERNS: ErrorPattern[] = [
    {
        regex: /InvalidXmlException\((.+?) in .+?:(\d+)\)/,
        parse: (match) => ({
            type: 'InvalidXml',
            message: match[1],
            line: parseInt(match[2], 10)
        })
    },
    {
        regex: /DescriptorNotFoundException\((.+?)\)/,
        parse: (match) => ({
            type: 'DescriptorNotFound',
            message: `Descriptor not found: ${match[1]}`,
            descriptorId: match[1]
        })
    },
    {
        regex: /ParsingException\(Parse error on line (\d+)/,
        parse: (match) => ({
            type: 'ParsingException',
            message: `ParsingException: ${match[1]}`,
            descriptorId: match[1]
        })
    }
];

function parseErrorMessage(errorMessage: string): ParsedError {
    for (const pattern of ERROR_PATTERNS) {
        const match = errorMessage.match(pattern.regex);
        if (match) {
            return pattern.parse(match);
        }
    }
    return { type: 'Unknown', message: errorMessage };
}

async function findDescriptorReference(
    document: vscode.TextDocument,
    descriptorId: string
): Promise<vscode.Position | null> {
    const text = document.getText();
    const searchPattern = `="#${descriptorId}"`;
    const index = text.indexOf(searchPattern);
    if (index !== -1) {
        return document.positionAt(index);
    }
    return null;
}

function navigateToPosition(editor: vscode.TextEditor, position: vscode.Position): void {
    editor.selection = new vscode.Selection(position, position);
    editor.revealRange(new vscode.Range(position, position));
}

async function showErrorMessage(error: string): Promise<void> {
    const parsedError = parseErrorMessage(error);
    const activeEditor = vscode.window.activeTextEditor;

    if (!activeEditor) {
        vscode.window.showErrorMessage(`Error rendering ALPS profile: ${parsedError.message}`);
        return;
    }

    switch (parsedError.type) {
        case 'InvalidXml':
        case 'ParsingException': {
            const selection = await vscode.window.showErrorMessage(
                `Error on line ${parsedError.line}: ${parsedError.message}`,
                'Go to Error'
            );
            if (selection === 'Go to Error' && parsedError.line) {
                const position = new vscode.Position(parsedError.line - 1, 0);
                navigateToPosition(activeEditor, position);
            }
            break;
        }

        case 'DescriptorNotFound': {
            const position = await findDescriptorReference(
                activeEditor.document,
                parsedError.descriptorId!
            );
            if (position) {
                const selection = await vscode.window.showErrorMessage(
                    parsedError.message,
                    'Go to Error'
                );
                if (selection === 'Go to Error') {
                    navigateToPosition(activeEditor, position);
                }
            } else {
                vscode.window.showErrorMessage(parsedError.message);
            }
            break;
        }

        default:
            vscode.window.showErrorMessage(
                `Error rendering ALPS profile: ${parsedError.type} : ${parsedError.message}`
            );
    }
}

function buildContentSecurityPolicy(webview: vscode.Webview): string {
    return `<meta http-equiv="Content-Security-Policy" content="
        default-src 'self' ${webview.cspSource};
        img-src 'self' ${webview.cspSource} https: data:;
        script-src 'self' ${webview.cspSource} https: 'unsafe-inline' 'unsafe-eval' blob:;
        style-src 'self' ${webview.cspSource} https: 'unsafe-inline';
        font-src 'self' ${webview.cspSource} https: data:;
        connect-src 'self' ${webview.cspSource} https:;
        worker-src 'self' blob:;
    ">`;
}

function transformHtmlForWebview(
    html: string,
    webview: vscode.Webview,
    filePath: string
): string {
    const dirPath = path.dirname(filePath);
    const csp = buildContentSecurityPolicy(webview);
    const baseHref = webview.asWebviewUri(vscode.Uri.file(dirPath));

    let content = html.replace('<head>', `<head>${csp}<base href="${baseHref}/"/>`);

    content = content.replace(/(src|href)="(.+?)"/g, (match, attr, value) => {
        if (value.startsWith('http')) {
            return match;
        }
        const resourcePath = vscode.Uri.file(path.join(dirPath, value));
        return `${attr}="${webview.asWebviewUri(resourcePath)}"`;
    });

    return content;
}

export function renderAsd(filePath: string, extensionPath: string): void {
    const pharPath = path.join(extensionPath, 'asd.phar');
    const command = `php "${pharPath}" -e "${filePath}"`;

    child_process.exec(command, async (error, stdout) => {
        if (error) {
            await showErrorMessage(error.message);
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

        panel.webview.html = transformHtmlForWebview(stdout, panel.webview, filePath);
    });
}
