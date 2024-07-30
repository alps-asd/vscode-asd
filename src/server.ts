import {
    createConnection,
    TextDocuments,
    ProposedFeatures,
    InitializeParams,
    TextDocumentSyncKind,
    TextDocumentChangeEvent,
    Diagnostic,
    DiagnosticSeverity
} from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { provideCompletionItems } from './completionItems';
import { parseAlpsProfile, DescriptorInfo } from './alpsParser';
import { validateXML } from './ImprovedXMLValidator';

const connection = createConnection(ProposedFeatures.all);
const documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);
let descriptors: DescriptorInfo[] = [];
let validationTimer: NodeJS.Timeout | null = null;

// エラーメッセージを抽出するヘルパー関数
function getErrorMessage(error: unknown): string {
    if (error instanceof Error) return error.message;
    return String(error);
}

process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    connection.console.error(`Uncaught Exception: ${getErrorMessage(error)}`);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    connection.console.error(`Unhandled Rejection: ${getErrorMessage(reason)}`);
});

connection.onInitialize((params: InitializeParams) => {
    console.log('ALPS Language Server initialized');
    return {
        capabilities: {
            completionProvider: {
                resolveProvider: true,
                triggerCharacters: ['<', ' ', '"', '#', '/']
            },
            textDocumentSync: TextDocumentSyncKind.Incremental,
        }
    };
});

documents.onDidChangeContent(async (change: TextDocumentChangeEvent<TextDocument>) => {
    try {
        const document = change.document;
        console.log(`Document changed. Language ID: ${document.languageId}`);

        if (document.languageId === 'alps-xml') {
            if (validationTimer) {
                clearTimeout(validationTimer);
            }

            validationTimer = setTimeout(async () => {
                try {
                    const diagnostics = validateXML(document.getText());

                    const immediateErrors = diagnostics.filter(d => d.severity === DiagnosticSeverity.Error);
                    connection.sendDiagnostics({ uri: document.uri, diagnostics: immediateErrors });

                    setTimeout(() => {
                        connection.sendDiagnostics({ uri: document.uri, diagnostics });
                    }, 1000);

                    descriptors = await parseAlpsProfile(document.getText());
                    console.log('Updated descriptors:', descriptors);
                } catch (error) {
                    console.error('Error in validation timer:', error);
                    connection.console.error(`Error in validation timer: ${getErrorMessage(error)}`);
                    // エラーが発生した場合でも空の診断情報を送信して、以前のエラー表示をクリアする
                    connection.sendDiagnostics({ uri: document.uri, diagnostics: [] });
                }
            }, 500);
        }
    } catch (error) {
        console.error('Error in onDidChangeContent:', error);
        connection.console.error(`Error in onDidChangeContent: ${getErrorMessage(error)}`);
    }
});

connection.onCompletion((params) => {
    try {
        return provideCompletionItems(params, documents, descriptors);
    } catch (error) {
        console.error('Error in onCompletion:', error);
        connection.console.error(`Error in onCompletion: ${getErrorMessage(error)}`);
        return [];
    }
});

documents.listen(connection);
connection.listen();

console.log('ALPS Language Server is running');
