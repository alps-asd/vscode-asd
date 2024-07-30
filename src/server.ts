import {
    createConnection,
    TextDocuments,
    ProposedFeatures,
    InitializeParams,
    TextDocumentSyncKind,
    TextDocumentChangeEvent,
    Diagnostic,
    DiagnosticSeverity,
    CompletionList,
    CompletionItem,
    CompletionItemKind,
    TextDocumentPositionParams
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
const documentLanguageIds: Map<string, string> = new Map();

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

documents.onDidOpen((event) => {
    const document = event.document;
    documentLanguageIds.set(document.uri, document.languageId);
    console.log(`Document opened. URI: ${document.uri}, Language ID: ${document.languageId}`);
});

documents.onDidClose((event) => {
    documentLanguageIds.delete(event.document.uri);
    console.log(`Document closed. URI: ${event.document.uri}`);
});

documents.onDidChangeContent(async (change: TextDocumentChangeEvent<TextDocument>) => {
    try {
        const document = change.document;
        const languageId = documentLanguageIds.get(document.uri) || document.languageId;
        console.log(`Document changed. URI: ${document.uri}, Language ID: ${languageId}`);
        if (languageId === 'alps-xml' || languageId === 'alps-json') {
            if (validationTimer) {
                clearTimeout(validationTimer);
            }
            validationTimer = setTimeout(async () => {
                try {
                    let diagnostics: Diagnostic[] = [];
                    if (languageId === 'alps-json') {
                        diagnostics = validateJson(document);
                    } else {
                        diagnostics = validateXML(document.getText());
                    }
                    const immediateErrors = diagnostics.filter(d => d.severity === DiagnosticSeverity.Error);
                    connection.sendDiagnostics({ uri: document.uri, diagnostics: immediateErrors });
                    setTimeout(() => {
                        connection.sendDiagnostics({ uri: document.uri, diagnostics });
                    }, 1000);

                    descriptors = await parseAlpsProfile(document.getText(), languageId);
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

connection.onCompletion((params: TextDocumentPositionParams): CompletionList => {
    console.log('=== Completion Requested ===');
    console.log('Document URI:', params.textDocument.uri);
    console.log('Position:', JSON.stringify(params.position));
    try {
        const document = documents.get(params.textDocument.uri);
        if (!document) {
            console.log('No document found');
            return CompletionList.create();
        }

        const languageId = documentLanguageIds.get(document.uri) || document.languageId;
        console.log('Document language ID:', languageId);

        const offset = document.offsetAt(params.position);
        const text = document.getText();
        const beforeText = text.slice(Math.max(0, offset - 10), offset);
        const afterText = text.slice(offset, Math.min(text.length, offset + 10));
        console.log('Text around cursor:', JSON.stringify({ before: beforeText, after: afterText }));

        if (languageId === 'alps-json') {
            console.log('Providing ALPS JSON completions');
            const completions = provideJsonCompletionItems(document, params);
            console.log('Completion items:', completions.items.map(item => item.label));
            return completions;
        } else if (languageId === 'alps-xml') {
            console.log('Providing XML completions');
            return provideCompletionItems(params, documents, descriptors);
        } else {
            console.log('Unsupported language ID:', languageId);
            return CompletionList.create();
        }
    } catch (error) {
        console.error('Error in onCompletion:', error);
        connection.console.error(`Error in onCompletion: ${getErrorMessage(error)}`);
        return CompletionList.create();
    }
});

connection.onCompletionResolve((item: CompletionItem): CompletionItem => {
    if (item.kind === CompletionItemKind.Property) {
        item.detail = `ALPS property: ${item.label}`;
        item.documentation = `This is a property in the ALPS specification for ${item.label}.`;
    } else if (item.kind === CompletionItemKind.Snippet) {
        item.detail = `ALPS snippet: ${item.label}`;
        item.documentation = `This snippet provides a template for ${item.label} in ALPS.`;
    }
    return item;
});

documents.listen(connection);
connection.listen();
console.log('ALPS Language Server is running');
