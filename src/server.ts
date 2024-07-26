import {
    createConnection,
    TextDocuments,
    ProposedFeatures,
    InitializeParams,
    CompletionItem,
    CompletionItemKind,
    TextDocumentPositionParams,
    TextDocumentChangeEvent,
    TextDocumentSyncKind,
    CompletionParams,
} from 'vscode-languageserver/node';

import { TextDocument } from 'vscode-languageserver-textdocument';
import * as xml2js from 'xml2js';

const connection = createConnection(ProposedFeatures.all);
const documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);

let descriptorIds: string[] = [];

connection.onInitialize((params: InitializeParams) => {
    console.log('ALPS Language Server initialized');
    return {
        capabilities: {
            completionProvider: {
                resolveProvider: true,
                triggerCharacters: ['#']
            },
            textDocumentSync: TextDocumentSyncKind.Incremental,
        }
    };
});

async function parseAlpsProfile(content: string): Promise<string[]> {
    try {
        const result = await xml2js.parseStringPromise(content);
        const ids = result.alps?.descriptor
            ?.filter((desc: any) => desc.$ && desc.$.id)
            .map((desc: any) => desc.$.id) || [];
        console.log('Extracted descriptor IDs:', ids);
        return ids;
    } catch (err) {
        console.error('Error parsing ALPS profile:', err);
        return [];
    }
}

documents.onDidChangeContent(async (change: TextDocumentChangeEvent<TextDocument>) => {
    const document = change.document;
    if (document.languageId === 'alps-xml') {
        descriptorIds = await parseAlpsProfile(document.getText());
        console.log('Updated descriptor IDs:', descriptorIds);
    }
});

connection.onCompletion(
    (params: CompletionParams): CompletionItem[] => {
        const document = documents.get(params.textDocument.uri);
        if (!document) {
            return [];
        }

        const text = document.getText();
        const offset = document.offsetAt(params.position);
        const linePrefix = text.slice(text.lastIndexOf('\n', offset - 1) + 1, offset);

        // Strictly check if we're in the correct context for descriptor ID completion
        if (!/href="#[^"]*$/.test(linePrefix)) {
            console.log('Not in descriptor ID completion context');
            return [];
        }

        console.log('Providing completions for descriptor IDs');
        return descriptorIds.map(id => ({
            label: id,
            kind: CompletionItemKind.Value,
            data: { type: 'descriptorId', id }
        }));
    }
);

connection.onCompletionResolve((item: CompletionItem): CompletionItem => {
    if (item.data && item.data.type === 'descriptorId') {
        item.detail = `Descriptor ID: ${item.data.id}`;
        item.documentation = 'Reference to an ALPS descriptor';
    }
    return item;
});

documents.listen(connection);
connection.listen();

console.log('ALPS Language Server is running');