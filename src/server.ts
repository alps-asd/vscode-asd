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
    TextDocumentPositionParams,
    CompletionTriggerKind,
    Logger,
    LogMessageNotification
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

// Create a simple logger
const logger: Logger = {
    error: (message: string) => connection.console.error(message),
    warn: (message: string) => connection.console.warn(message),
    info: (message: string) => connection.console.info(message),
    log: (message: string) => connection.console.log(message)
};

function getErrorMessage(error: unknown): string {
    if (error instanceof Error) return error.message;
    return String(error);
}

connection.onInitialize((params: InitializeParams) => {
    logger.info('ALPS Language Server initialized');
    return {
        capabilities: {
            completionProvider: {
                resolveProvider: true,
                triggerCharacters: ['<', ' ', '"', '#', '/', '{', ':', ',']
            },
            textDocumentSync: TextDocumentSyncKind.Incremental,
        }
    };
});

documents.onDidOpen((event) => {
    const document = event.document;
    documentLanguageIds.set(document.uri, document.languageId);
    logger.info(`Document opened. URI: ${document.uri}, Language ID: ${document.languageId}`);
});

documents.onDidClose((event) => {
    documentLanguageIds.delete(event.document.uri);
    logger.info(`Document closed. URI: ${event.document.uri}`);
});

documents.onDidChangeContent(async (change: TextDocumentChangeEvent<TextDocument>) => {
    try {
        const document = change.document;
        const languageId = documentLanguageIds.get(document.uri) || document.languageId;
        logger.info(`Document changed. URI: ${document.uri}, Language ID: ${languageId}`);
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
                    logger.info(`Updated descriptors: ${JSON.stringify(descriptors)}`);
                } catch (error) {
                    logger.error(`Error in validation timer: ${getErrorMessage(error)}`);
                    connection.sendDiagnostics({ uri: document.uri, diagnostics: [] });
                }
            }, 500);
        }
    } catch (error) {
        logger.error(`Error in onDidChangeContent: ${getErrorMessage(error)}`);
    }
});

connection.onCompletion((params: TextDocumentPositionParams & { context?: { triggerKind: CompletionTriggerKind, triggerCharacter?: string } }): CompletionList => {
    logger.info('=== Completion Requested ===');
    logger.info(`Document URI: ${params.textDocument.uri}`);
    logger.info(`Position: ${JSON.stringify(params.position)}`);
    logger.info(`Trigger Kind: ${params.context?.triggerKind}`);
    logger.info(`Trigger Character: ${params.context?.triggerCharacter}`);

    try {
        const document = documents.get(params.textDocument.uri);
        if (!document) {
            logger.warn('No document found');
            return CompletionList.create();
        }

        const languageId = documentLanguageIds.get(document.uri) || document.languageId;
        logger.info(`Document language ID: ${languageId}`);

        const offset = document.offsetAt(params.position);
        const text = document.getText();
        const beforeText = text.slice(Math.max(0, offset - 10), offset);
        const afterText = text.slice(offset, Math.min(text.length, offset + 10));
        logger.info(`Text around cursor: ${JSON.stringify({ before: beforeText, after: afterText })}`);

        if (languageId === 'alps-json') {
            logger.info('Providing ALPS JSON completions');
            const completions = provideJsonCompletionItems(document, params, descriptors);
            logger.info(`JSON Completions: ${JSON.stringify(completions)}`);
            return completions;
        } else if (languageId === 'alps-xml') {
            logger.info('Providing XML completions');
            return provideCompletionItems(params, documents, descriptors);
        } else {
            logger.warn(`Unsupported language ID: ${languageId}`);
            return CompletionList.create();
        }
    } catch (error) {
        logger.error(`Error in onCompletion: ${getErrorMessage(error)}`);
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
    logger.info(`Completion item resolved: ${JSON.stringify(item)}`);
    return item;
});

documents.listen(connection);
connection.listen();
logger.info('ALPS Language Server is running');

// Send all logger messages to the client
connection.onNotification(LogMessageNotification.type, (params) => {
    connection.sendNotification(LogMessageNotification.type, params);
});
