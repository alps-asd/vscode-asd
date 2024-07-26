import {
    createConnection,
    TextDocuments,
    ProposedFeatures,
    InitializeParams,
    CompletionItem,
    CompletionItemKind,
    TextDocumentPositionParams,
  } from 'vscode-languageserver/node';
  
  import { TextDocument } from 'vscode-languageserver-textdocument';
  import * as xml2js from 'xml2js';
  import * as fs from 'fs';
  
  // Create a connection for the server
  const connection = createConnection(ProposedFeatures.all);
  
  // Create a simple text document manager
  const documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);
  
  let descriptorIds: string[] = [];
  
  connection.onInitialize((params: InitializeParams) => {
    return {
      capabilities: {
        completionProvider: {
          resolveProvider: true,
          triggerCharacters: ['#']
        }
      }
    };
  });
  
  // Parse ALPS profile and extract descriptor IDs
  function parseAlpsProfile(content: string): Promise<string[]> {
    return new Promise((resolve, reject) => {
      xml2js.parseString(content, (err, result) => {
        if (err) {
          reject(err);
        } else {
          const ids = result.alps.descriptor
            .filter((desc: any) => desc.$ && desc.$.id)
            .map((desc: any) => desc.$.id);
          resolve(ids);
        }
      });
    });
  }
  
  // Update descriptor IDs when document changes
  documents.onDidChangeContent(change => {
    const document = change.document;
    if (document.languageId === 'xml') {
      parseAlpsProfile(document.getText())
        .then(ids => {
          descriptorIds = ids;
        })
        .catch(err => console.error('Error parsing ALPS profile:', err));
    }
  });
  
  // Provide completion items
  connection.onCompletion(
    (_textDocumentPosition: TextDocumentPositionParams): CompletionItem[] => {
      return descriptorIds.map(id => ({
        label: id,
        kind: CompletionItemKind.Value,
        data: id
      }));
    }
  );
  
  // Listen on the connection
  documents.listen(connection);
  connection.listen();
  