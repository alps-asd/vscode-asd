import * as vscode from 'vscode';
import * as path from 'path';
import * as child_process from 'child_process';

type ErrorType = 'InvalidXml' | 'DescriptorNotFound' | 'ParsingException' | 'InvalidDescriptorException' | 'Unknown';

interface ParsedError {
    type: ErrorType;
    message: string;
    line?: number;
    descriptorId?: string;
}

const ERROR_PATTERNS: Array<{
    regex: RegExp;
    parse: (match: RegExpMatchArray) => ParsedError;
}> = [
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
            line: parseInt(match[1], 10)
        })
    }
];

function parseErrorMessage(errorMessage: string): ParsedError {
    for (const { regex, parse } of ERROR_PATTERNS) {
        const match = errorMessage.match(regex);
        if (match) {
            return parse(match);
        }
    }

    return {
        type: 'Unknown',
        message: errorMessage
    };
}

function findDescriptorReference(document: vscode.TextDocument, descriptorId: string): vscode.Position | null {
    const text = document.getText();
    const searchPattern = `="#${descriptorId}"`;
    const index = text.indexOf(searchPattern);

    return index !== -1 ? document.positionAt(index) : null;
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
                navigateToPosition(activeEditor, new vscode.Position(parsedError.line - 1, 0));
            }
            break;
        }

        case 'DescriptorNotFound': {
            const position = findDescriptorReference(activeEditor.document, parsedError.descriptorId!);
            if (position) {
                const selection = await vscode.window.showErrorMessage(parsedError.message, 'Go to Error');
                if (selection === 'Go to Error') {
                    navigateToPosition(activeEditor, position);
                }
            } else {
                vscode.window.showErrorMessage(parsedError.message);
            }
            break;
        }

        default:
            vscode.window.showErrorMessage(`Error rendering ALPS profile: ${parsedError.type}: ${parsedError.message}`);
    }
}

function buildContentSecurityPolicy(webview: vscode.Webview): string {
    const cspSource = webview.cspSource;
    return `<meta http-equiv="Content-Security-Policy" content="
        default-src 'self' ${cspSource};
        img-src 'self' ${cspSource} https: data:;
        script-src 'self' ${cspSource} https: 'unsafe-inline' 'unsafe-eval' blob:;
        style-src 'self' ${cspSource} https: 'unsafe-inline';
        font-src 'self' ${cspSource} https: data:;
        connect-src 'self' ${cspSource} https:;
        worker-src 'self' blob:;
    ">`;
}

function transformHtmlForWebview(
    html: string,
    webview: vscode.Webview,
    filePath: string
): string {
    const baseDir = path.dirname(filePath);
    const baseUri = webview.asWebviewUri(vscode.Uri.file(baseDir));
    const csp = buildContentSecurityPolicy(webview);

    let content = html.replace('<head>', `<head>${csp}<base href="${baseUri}/" />`);

    content = content.replace(/(src|href)="(.+?)"/g, (match, attr, value) => {
        if (value.startsWith('http')) {
            return match;
        }
        const resourcePath = vscode.Uri.file(path.join(baseDir, value));
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
