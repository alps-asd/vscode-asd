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

interface DescriptorInfo {
    id: string;
    type?: string;
}

let descriptors: DescriptorInfo[] = [];
let lastValidDescriptors: DescriptorInfo[] = [];

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

function extractDescriptors(content: string): DescriptorInfo[] {
    const regex = /<descriptor[^>]*id="([^"]*)"[^>]*(?:type="([^"]*)")?[^>]*>/g;
    const descriptors: DescriptorInfo[] = [];
    let match;
    while ((match = regex.exec(content)) !== null) {
        descriptors.push({ id: match[1], type: match[2] });
    }
    return descriptors;
}

async function parseAlpsProfile(content: string): Promise<DescriptorInfo[]> {
    try {
        const result = await xml2js.parseStringPromise(content);
        const descriptors = result.alps?.descriptor
            ?.map((desc: any) => ({
                id: desc.$.id,
                type: desc.$.type
            })) || [];
        console.log('Extracted descriptors (XML parsing):', descriptors);
        lastValidDescriptors = descriptors;
        return descriptors;
    } catch (err) {
        console.error('Error parsing ALPS profile:', err);
        // Fall back to regex-based extraction
        const regexDescriptors = extractDescriptors(content);
        console.log('Extracted descriptors (regex fallback):', regexDescriptors);
        return regexDescriptors.length > 0 ? regexDescriptors : lastValidDescriptors;
    }
}

documents.onDidChangeContent(async (change: TextDocumentChangeEvent<TextDocument>) => {
    const document = change.document;
    console.log(`Document changed. Language ID: ${document.languageId}`);
    if (document.languageId === 'alps-xml') {
        descriptors = await parseAlpsProfile(document.getText());
        console.log('Updated descriptors:', descriptors);
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
    const hrefMatch = /href="#[^"]*$/.test(linePrefix);
    const rtMatch = /rt="#[^"]*$/.test(linePrefix);

    if (!hrefMatch && !rtMatch) {
        console.log('Not in descriptor ID completion context');
        return [];
    }

    console.log('Providing completions for descriptor IDs');
    return descriptors
        .filter(desc => {
            if (rtMatch) {
                // For rt, exclude descriptors with type safe, unsafe, or idempotent
                return !['safe', 'unsafe', 'idempotent'].includes(desc.type || '');
            }
            return true; // Include all descriptors for href
        })
        .map(desc => ({
            label: desc.id,
            kind: CompletionItemKind.Value,
            data: { type: 'descriptorId', id: desc.id, descriptorType: desc.type }
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
        item.documentation = `Type: ${item.data.descriptorType || 'Not specified'}`;
    }
    return item;
});

documents.listen(connection);
connection.listen();

console.log('ALPS Language Server is running');
