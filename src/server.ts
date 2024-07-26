import {
    createConnection,
    TextDocuments,
    ProposedFeatures,
    InitializeParams,
    CompletionItem,
    CompletionItemKind,
    CompletionParams,
    CompletionList,
    TextDocumentSyncKind,
    TextDocumentChangeEvent
} from 'vscode-languageserver/node';

import { TextDocument } from 'vscode-languageserver-textdocument';
import * as xml2js from 'xml2js';
import * as sax from 'sax';

const connection = createConnection(ProposedFeatures.all);
const documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);

interface DescriptorInfo {
    id: string;
    type: string;
}

let descriptors: DescriptorInfo[] = [];
let lastValidDescriptors: DescriptorInfo[] = [];

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

async function parseAlpsProfile(content: string): Promise<DescriptorInfo[]> {
    try {
        const result = await xml2js.parseStringPromise(content);
        const descriptors = result.alps?.descriptor
            ?.map((desc: any) => ({
                id: desc.$.id,
                type: desc.$.type || 'semantic'
            })) || [];
        console.log('Extracted descriptors (XML parsing):', descriptors);
        if (descriptors.length > 0) {
            lastValidDescriptors = descriptors;
        }
        return lastValidDescriptors;
    } catch (err) {
        console.error('Error parsing ALPS profile:', err);
        const saxDescriptors = await extractDescriptors(content);
        console.log('Extracted descriptors (SAX fallback):', saxDescriptors);
        if (saxDescriptors.length > 0) {
            lastValidDescriptors = saxDescriptors;
        }
        return lastValidDescriptors;
    }
}

function extractDescriptors(content: string): Promise<DescriptorInfo[]> {
    return new Promise((resolve) => {
        const parser = sax.parser(true);
        const descriptors: DescriptorInfo[] = [];

        parser.onopentag = (node) => {
            if (node.name === 'descriptor') {
                const id = node.attributes.id as string;
                const type = (node.attributes.type as string) || 'semantic';
                if (id) {
                    descriptors.push({ id, type });
                }
            }
        };

        parser.onend = () => {
            resolve(descriptors);
        };

        parser.onerror = () => {
            parser.resume();
        };

        parser.write(content).close();
    });
}

documents.onDidChangeContent(async (change: TextDocumentChangeEvent<TextDocument>) => {
    const document = change.document;
    console.log(`Document changed. Language ID: ${document.languageId}`);
    if (document.languageId === 'alps-xml') {
        descriptors = await parseAlpsProfile(document.getText());
        console.log('Updated descriptors:', descriptors);
    }
});

function getOpenTags(text: string, currentPosition: number): string[] {
    const openTags: string[] = [];
    let depth = 0;
    let lastOpenTag = '';

    for (let i = currentPosition - 1; i >= 0; i--) {
        if (text[i] === '>') {
            depth++;
        } else if (text[i] === '<') {
            if (text[i + 1] === '/') {
                depth++;
            } else {
                depth--;
                if (depth < 0) {
                    const tagMatch = text.slice(i).match(/<(\w+)/);
                    if (tagMatch) {
                        lastOpenTag = tagMatch[1];
                        openTags.unshift(lastOpenTag);
                        depth = 0;
                    }
                }
            }
        }

        if (openTags.length >= 5) break;
    }

    return openTags;
}

function provideCompletionItems(params: CompletionParams): CompletionList {
    const document = documents.get(params.textDocument.uri);
    if (!document) {
        console.log('No document found for completion');
        return { isIncomplete: false, items: [] };
    }

    const text = document.getText();
    const offset = document.offsetAt(params.position);
    const linePrefix = text.slice(text.lastIndexOf('\n', offset - 1) + 1, offset);
    console.log('Line prefix:', linePrefix);
    console.log('Offset:', offset);

    const insideAlps = /<alps[^>]*>[\s\S]*$/.test(text.slice(0, offset));
    const tagStart = /<\s*([a-zA-Z]*)?$/.test(linePrefix);
    const attributeStart = /\s+\w*$/.test(linePrefix);
    const insideTypeAttr = /\s+type=["'][^"']*$/.test(linePrefix);
    const insideHrefAttr = /\s+href=["'][^"']*$/.test(linePrefix);
    const insideRtAttr = /\s+rt=["'][^"']*$/.test(linePrefix);
    const tagClosing = /<\/\w*$/.test(linePrefix);
    console.log('insideAlps:', insideAlps, 'tagStart:', tagStart, 'attributeStart:', attributeStart, 'insideTypeAttr:', insideTypeAttr, 'insideHrefAttr:', insideHrefAttr, 'insideRtAttr:', insideRtAttr, 'tagClosing:', tagClosing);

    let items: CompletionItem[] = [];

    if (tagClosing) {
        console.log('Attempting to close tag');
        const openTags = getOpenTags(text, offset);
        console.log('Open tags:', openTags);
        items = openTags.map(tag => ({
            label: tag,
            kind: CompletionItemKind.Property,
            insertText: `${tag}>`,
            documentation: `Close <${tag}> tag`
        }));
    } else if (insideTypeAttr) {
        items = [
            { label: 'semantic', kind: CompletionItemKind.EnumMember },
            { label: 'safe', kind: CompletionItemKind.EnumMember },
            { label: 'unsafe', kind: CompletionItemKind.EnumMember },
            { label: 'idempotent', kind: CompletionItemKind.EnumMember }
        ];
    } else if (insideHrefAttr) {
        items = descriptors.map(descriptor => ({
            label: `#${descriptor.id}`,
            kind: CompletionItemKind.Reference,
            documentation: `Reference to ${descriptor.type} descriptor with id ${descriptor.id}`
        }));
    } else if (insideRtAttr) {
        items = descriptors
            .filter(descriptor => descriptor.type === 'semantic')
            .map(descriptor => ({
                label: `#${descriptor.id}`,
                kind: CompletionItemKind.Reference,
                documentation: `Transition to ${descriptor.id}`
            }));
    } else if (tagStart) {
        if (!insideAlps) {
            items = [{ label: 'alps', kind: CompletionItemKind.Class }];
        } else {
            items = [
                { label: 'title', kind: CompletionItemKind.Property },
                { label: 'doc', kind: CompletionItemKind.Property },
                { label: 'link', kind: CompletionItemKind.Property },
                { label: 'descriptor', kind: CompletionItemKind.Property }
            ];
        }
    } else if (attributeStart) {
        const currentAttributes: string[] = linePrefix.match(/\b\w+(?==)/g) || [];
        const availableAttributes = ['id', 'href', 'type', 'rt', 'rel', 'title', 'tag']
            .filter(attr => !currentAttributes.includes(attr));

        items = availableAttributes.map(attr => ({
            label: attr,
            kind: CompletionItemKind.Property
        }));
    }

    console.log(`Providing ${items.length} completion items`);
    return { isIncomplete: false, items };
}

connection.onCompletion((params: CompletionParams): CompletionList => {
    console.log('Completion requested', JSON.stringify(params));
    return provideCompletionItems(params);
});

connection.onCompletionResolve((item: CompletionItem): CompletionItem => {
    if (item.data && item.data.type === 'descriptorId') {
        item.detail = `Descriptor ID: ${item.data.id}`;
        item.documentation = `Type: ${item.data.descriptorType}`;
    }
    return item;
});

documents.listen(connection);
connection.listen();

console.log('ALPS Language Server is running');
