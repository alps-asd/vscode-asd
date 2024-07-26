import {
  createConnection,
  TextDocuments,
  ProposedFeatures,
  InitializeParams,
  CompletionItem,
  CompletionItemKind,
  TextDocumentPositionParams,
  TextDocumentChangeEvent,
  CompletionContext,
  CompletionTriggerKind,
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
      textDocumentSync: documents.syncKind,
    }
  };
});

// Parse ALPS profile and extract descriptor IDs
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

// Update descriptor IDs when document changes
documents.onDidChangeContent(async (change: TextDocumentChangeEvent<TextDocument>) => {
  const document = change.document;
  if (document.languageId === 'xml') {
    descriptorIds = await parseAlpsProfile(document.getText());
    console.log('Updated descriptor IDs:', descriptorIds);
  }
});

// Provide completion items
connection.onCompletion(
    async (
        textDocumentPosition: TextDocumentPositionParams,
        context: CompletionContext
    ): Promise<CompletionItem[]> => {
      const document = documents.get(textDocumentPosition.textDocument.uri);
      if (!document) {
        return [];
      }

      const text = document.getText();
      const offset = document.offsetAt(textDocumentPosition.position);
      const line = document.getText({
        start: { line: textDocumentPosition.position.line, character: 0 },
        end: textDocumentPosition.position
      });

      // Only provide completions for '#' trigger or when explicitly invoked after 'href="#'
      if (
          (context.triggerKind === CompletionTriggerKind.TriggerCharacter && context.triggerCharacter === '#') ||
          (context.triggerKind === CompletionTriggerKind.Invoked && /href="#[^"]*$/.test(line))
      ) {
        console.log('Providing completions for descriptor IDs');
        return descriptorIds.map(id => ({
          label: id,
          kind: CompletionItemKind.Value,
          data: { type: 'descriptorId', id }
        }));
      }

      return [];
    }
);

connection.onCompletionResolve((item: CompletionItem): CompletionItem => {
  if (item.data && item.data.type === 'descriptorId') {
    item.detail = `Descriptor ID: ${item.data.id}`;
    item.documentation = 'Reference to an ALPS descriptor';
  }
  return item;
});

// Listen on the connection
documents.listen(connection);
connection.listen();

console.log('ALPS Language Server is running');
