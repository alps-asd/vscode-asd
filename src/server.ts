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
    CompletionTriggerKind,
} from 'vscode-languageserver/node';

import { TextDocument } from 'vscode-languageserver-textdocument';
import * as xml2js from 'xml2js';

const connection = createConnection(ProposedFeatures.all);
const documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);

let descriptorIds: string[] = [];
let lastValidDescriptorIds: string[] = [];

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

function extractDescriptorIds(content: string): string[] {
    const regex = /<descriptor[^>]*id="([^"]*)"[^>]*>/g;
    const ids: string[] = [];
    let match;
    while ((match = regex.exec(content)) !== null) {
        ids.push(match[1]);
    }
    return ids;
}

async function parseAlpsProfile(content: string): Promise<string[]> {
    try {
        const result = await xml2js.parseStringPromise(content);
        const ids = result.alps?.descriptor
            ?.filter((desc: any) => desc.$ && desc.$.id)
            .map((desc: any) => desc.$.id) || [];
        console.log('Extracted descriptor IDs (XML parsing):', ids);
        lastValidDescriptorIds = ids;
        return ids;
    } catch (err) {
        console.error('Error parsing ALPS profile:', err);
        // Fall back to regex-based extraction
        const regexIds = extractDescriptorIds(content);
        console.log('Extracted descriptor IDs (regex fallback):', regexIds);
        return regexIds.length > 0 ? regexIds : lastValidDescriptorIds;
    }
}

documents.onDidChangeContent(async (change: TextDocumentChangeEvent<TextDocument>) => {
    const document = change.document;
    console.log(`Document changed. Language ID: ${document.languageId}`);
    if (document.languageId === 'alps-xml') {
        descriptorIds = await parseAlpsProfile(document.getText());
        console.log('Updated descriptor IDs:', descriptorIds);
    }
});

function provideCompletionItems(params: CompletionParams): CompletionItem[] {
    const document = documents.get(params.textDocument.uri);
    if (!document) {
        console.log('No document found for completion');
        return [];
    }

    const text = document.getText();
    const offset = document.offsetAt(params.position);
    const linePrefix = text.slice(text.lastIndexOf('\n', offset - 1) + 1, offset);
    console.log('Line prefix:', linePrefix);

    // Check if we're in the correct context for descriptor ID completion
    if (!/(?:href|rt)="#[^"]*$/.test(linePrefix)) {
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

connection.onCompletion((params: CompletionParams): CompletionItem[] => {
    console.log('Completion requested', JSON.stringify(params.context));

    // Provide completions for both href="#" and rt="#"
    if (params.context?.triggerKind === CompletionTriggerKind.TriggerCharacter &&
        params.context.triggerCharacter === '#') {
        console.log('Trigger character "#" detected, providing completions');
        return provideCompletionItems(params);
    }

    // Disable all other completions
    console.log('Completion request ignored');
    return [];
});

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
