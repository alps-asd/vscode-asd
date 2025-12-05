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
    LogMessageNotification
} from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { provideCompletionItems } from './completionItems';
import { parseAlpsProfile, DescriptorInfo } from './alpsParser';
import { validateXML } from './ImprovedXMLValidator';
import { validateJson } from './jsonValidator';
import { provideJsonCompletionItems } from './jsonCompletion';

type AlpsLanguageId = 'alps-xml' | 'alps-json';

const VALIDATION_DELAY_MS = 500;
const FULL_DIAGNOSTICS_DELAY_MS = 1000;

const connection = createConnection(ProposedFeatures.all);
const documents = new TextDocuments(TextDocument);
const documentLanguageIds = new Map<string, string>();

let descriptors: DescriptorInfo[] = [];
let validationTimer: NodeJS.Timeout | null = null;

const logger = {
    error: (message: string) => connection.console.error(message),
    warn: (message: string) => connection.console.warn(message),
    info: (message: string) => connection.console.info(message),
    log: (message: string) => connection.console.log(message)
};

function getErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}

function isAlpsLanguage(languageId: string): languageId is AlpsLanguageId {
    return languageId === 'alps-xml' || languageId === 'alps-json';
}

function getLanguageId(document: TextDocument): string {
    return documentLanguageIds.get(document.uri) || document.languageId;
}

connection.onInitialize((_params: InitializeParams) => {
    logger.info('ALPS Language Server initialized');
    return {
        capabilities: {
            completionProvider: {
                resolveProvider: true,
                triggerCharacters: ['<', ' ', '"', '#', '/', '{', ':', ',']
            },
            textDocumentSync: TextDocumentSyncKind.Incremental
        }
    };
});

documents.onDidOpen((event) => {
    const { uri, languageId } = event.document;
    documentLanguageIds.set(uri, languageId);
    logger.info(`Document opened: ${uri}`);
});

documents.onDidClose((event) => {
    documentLanguageIds.delete(event.document.uri);
    logger.info(`Document closed: ${event.document.uri}`);
});

documents.onDidChangeContent(async (change: TextDocumentChangeEvent<TextDocument>) => {
    const document = change.document;
    const languageId = getLanguageId(document);

    if (!isAlpsLanguage(languageId)) {
        return;
    }

    if (validationTimer) {
        clearTimeout(validationTimer);
    }

    validationTimer = setTimeout(() => validateDocument(document, languageId), VALIDATION_DELAY_MS);
});

async function validateDocument(document: TextDocument, languageId: AlpsLanguageId): Promise<void> {
    try {
        const diagnostics = languageId === 'alps-json'
            ? validateJson(document)
            : validateXML(document.getText());

        const immediateErrors = diagnostics.filter((d) => d.severity === DiagnosticSeverity.Error);
        connection.sendDiagnostics({ uri: document.uri, diagnostics: immediateErrors });

        setTimeout(() => {
            connection.sendDiagnostics({ uri: document.uri, diagnostics });
        }, FULL_DIAGNOSTICS_DELAY_MS);

        descriptors = await parseAlpsProfile(document.getText(), languageId);
    } catch (error) {
        logger.error(`Validation error: ${getErrorMessage(error)}`);
        connection.sendDiagnostics({ uri: document.uri, diagnostics: [] });
    }
}

interface CompletionParams extends TextDocumentPositionParams {
    context?: {
        triggerKind: CompletionTriggerKind;
        triggerCharacter?: string;
    };
}

connection.onCompletion((params: CompletionParams): CompletionList => {
    try {
        const document = documents.get(params.textDocument.uri);
        if (!document) {
            logger.warn('Completion requested for unknown document');
            return CompletionList.create();
        }

        const languageId = getLanguageId(document);

        if (languageId === 'alps-json') {
            return provideJsonCompletionItems(document, params, descriptors);
        }

        if (languageId === 'alps-xml') {
            return provideCompletionItems(params, documents, descriptors);
        }

        return CompletionList.create();
    } catch (error) {
        logger.error(`Completion error: ${getErrorMessage(error)}`);
        return CompletionList.create();
    }
});

connection.onCompletionResolve((item: CompletionItem): CompletionItem => {
    const label = item.label;

    if (item.kind === CompletionItemKind.Property) {
        item.detail = `ALPS property: ${label}`;
        item.documentation = `Property in the ALPS specification for ${label}.`;
    } else if (item.kind === CompletionItemKind.Snippet) {
        item.detail = `ALPS snippet: ${label}`;
        item.documentation = `Template for ${label} in ALPS.`;
    }

    return item;
});

documents.listen(connection);
connection.listen();
logger.info('ALPS Language Server is running');

connection.onNotification(LogMessageNotification.type, (params) => {
    connection.sendNotification(LogMessageNotification.type, params);
});
