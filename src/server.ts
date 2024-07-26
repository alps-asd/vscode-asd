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
    CompletionList,
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
                triggerCharacters: ['<', ' ', '"', '#']
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
        lastValidDescriptors = descriptors;  // Update only if we got valid descriptors
      }
      return lastValidDescriptors;
    } catch (err) {
      console.error('Error parsing ALPS profile:', err);
      // Fall back to SAX-based extraction only if we don't have valid descriptors
      if (lastValidDescriptors.length === 0) {
        const saxDescriptors = await extractDescriptors(content);
        console.log('Extracted descriptors (SAX fallback):', saxDescriptors);
        if (saxDescriptors.length > 0) {
          lastValidDescriptors = saxDescriptors;
        }
      } else {
        console.log('Using last valid descriptors');
      }
      return lastValidDescriptors;
    }
  }
  
  function extractDescriptors(content: string): Promise<DescriptorInfo[]> {
    return new Promise((resolve, reject) => {
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
  
      parser.onerror = (err) => {
        reject(err);
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

    // Check for different completion contexts
    const hrefMatch = /href="#[^"]*$/.test(linePrefix);
    const rtMatch = /rt="#[^"]*$/.test(linePrefix);
    const idMatch = /id="#[^"]*$/.test(linePrefix);
    const tagStart = /<[^>]*$/.test(linePrefix);
    const attributeStart = /\s[^=]*$/.test(linePrefix);

    let items: CompletionItem[] = [];

    if (hrefMatch || rtMatch) {
        items = descriptors
            .filter(desc => rtMatch ? desc.type === 'semantic' : true)
            .map(desc => ({
                label: desc.id,
                kind: CompletionItemKind.Value,
                data: { type: 'descriptorId', id: desc.id, descriptorType: desc.type }
            }));
    } else if (idMatch) {
        items = descriptors.map(desc => ({
            label: desc.id,
            kind: CompletionItemKind.Value,
            data: { type: 'descriptorId', id: desc.id, descriptorType: desc.type }
        }));
    } else if (tagStart) {
        items = [
            { label: 'descriptor', kind: CompletionItemKind.Property },
            { label: 'alps', kind: CompletionItemKind.Property },
            // Add other ALPS-specific tags here
        ];
    } else if (attributeStart) {
        items = [
            { label: 'id', kind: CompletionItemKind.Property },
            { label: 'href', kind: CompletionItemKind.Property },
            { label: 'rt', kind: CompletionItemKind.Property },
            { label: 'type', kind: CompletionItemKind.Property },
            // Add other ALPS-specific attributes here
        ];
    }

    console.log(`Providing ${items.length} completion items`);
    return { isIncomplete: false, items };
}

connection.onCompletion((params: CompletionParams): CompletionList => {
    console.log('Completion requested', JSON.stringify(params.context));
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
