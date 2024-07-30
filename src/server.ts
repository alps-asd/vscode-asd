import {
    createConnection,
    TextDocuments,
    ProposedFeatures,
    InitializeParams,
    TextDocumentSyncKind,
    TextDocumentChangeEvent,
    Diagnostic,
    DiagnosticSeverity,
    CompletionList
} from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { provideCompletionItems } from './completionItems';
import { parseAlpsProfile, DescriptorInfo } from './alpsParser';
import { validateXML } from './ImprovedXMLValidator';
import { validateJson } from './jsonValidator';
import { provideJsonCompletionItems } from './jsonCompletion';

const connection = createConnection(ProposedFeatures.all);
const documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);
let descriptors: DescriptorInfo[] = [];
let validationTimer: NodeJS.Timeout | null = null;

function getErrorMessage(error: unknown): string {
    if (error instanceof Error) return error.message;
    return String(error);
}

connection.onInitialize((params: InitializeParams) => {
    console.log('ALPS Language Server initialized');
    return {
        capabilities: {
            completionProvider: {
                resolveProvider: true,
                triggerCharacters: ['<', ' ', '"', '#', '/', '{', ':']
            },
            textDocumentSync: TextDocumentSyncKind.Incremental,
        }
    };
});

documents.onDidChangeContent(async (change: TextDocumentChangeEvent<TextDocument>) => {
    try {
        const document = change.document;
        console.log(`Document changed. Language ID: ${document.languageId}`);
        if (document.languageId === 'alps-xml' || document.languageId === 'alps-json') {
            if (validationTimer) {
                clearTimeout(validationTimer);
            }
            validationTimer = setTimeout(async () => {
                try {
                    let diagnostics: Diagnostic[] = [];
                    if (document.languageId === 'alps-json') {
                        diagnostics = validateJson(document);
                    } else {
                        diagnostics = validateXML(document.getText());
                    }
                    const immediateErrors = diagnostics.filter(d => d.severity === DiagnosticSeverity.Error);
                    connection.sendDiagnostics({ uri: document.uri, diagnostics: immediateErrors });
                    setTimeout(() => {
                        connection.sendDiagnostics({ uri: document.uri, diagnostics });
                    }, 1000);

                    descriptors = await parseAlpsProfile(document.getText(), document.languageId);
                    console.log('Updated descriptors:', descriptors);
                } catch (error) {
                    console.error('Error in validation timer:', error);
                    connection.console.error(`Error in validation timer: ${getErrorMessage(error)}`);
                    connection.sendDiagnostics({ uri: document.uri, diagnostics: [] });
                }
            }, 500);
        }
    } catch (error) {
        console.error('Error in onDidChangeContent:', error);
        connection.console.error(`Error in onDidChangeContent: ${getErrorMessage(error)}`);
    }
});

connection.onCompletion((params): CompletionList => {
    try {
        const document = documents.get(params.textDocument.uri);
        if (!document) {
            return { isIncomplete: false, items: [] };
        }

        if (document.languageId === 'alps-json') {
            return provideJsonCompletionItems(document, params);
        } else {
            return provideCompletionItems(params, documents, descriptors);
        }
    } catch (error) {
        console.error('Error in onCompletion:', error);
        connection.console.error(`Error in onCompletion: ${getErrorMessage(error)}`);
        return { isIncomplete: false, items: [] };
    }
});

documents.listen(connection);
connection.listen();
console.log('ALPS Language Server is running');
