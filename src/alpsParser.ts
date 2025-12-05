import * as xml2js from 'xml2js';
import * as sax from 'sax';
import { parseJson } from './jsonParser';

export interface DescriptorInfo {
    id: string;
    type: string;
}

interface AlpsJsonDescriptor {
    id?: string;
    type?: string;
}

interface AlpsJsonProfile {
    alps?: {
        descriptor?: AlpsJsonDescriptor[];
    };
}

interface XmlDescriptor {
    $: {
        id?: string;
        type?: string;
    };
}

interface XmlAlpsProfile {
    alps?: {
        descriptor?: XmlDescriptor[];
    };
}

const DEFAULT_DESCRIPTOR_TYPE = 'semantic';

export async function parseAlpsProfile(content: string, languageId: string): Promise<DescriptorInfo[]> {
    return languageId === 'alps-json'
        ? parseJsonAlpsProfile(content)
        : parseXmlAlpsProfile(content);
}

function parseJsonAlpsProfile(content: string): DescriptorInfo[] {
    try {
        const jsonContent = parseJson(content) as AlpsJsonProfile | null;

        if (!jsonContent?.alps?.descriptor) {
            return [];
        }

        return jsonContent.alps.descriptor
            .filter((desc): desc is AlpsJsonDescriptor & { id: string } => typeof desc.id === 'string')
            .map((desc) => ({
                id: desc.id,
                type: desc.type || DEFAULT_DESCRIPTOR_TYPE
            }));
    } catch {
        return [];
    }
}

async function parseXmlAlpsProfile(content: string): Promise<DescriptorInfo[]> {
    try {
        const result = await xml2js.parseStringPromise(content, { strict: false }) as XmlAlpsProfile;

        const descriptors = result.alps?.descriptor
            ?.filter((desc): desc is XmlDescriptor & { $: { id: string } } => typeof desc.$.id === 'string')
            .map((desc) => ({
                id: desc.$.id,
                type: desc.$.type || DEFAULT_DESCRIPTOR_TYPE
            })) || [];

        if (descriptors.length > 0) {
            return descriptors;
        }

        return extractDescriptorsWithSax(content);
    } catch {
        return extractDescriptorsWithSax(content);
    }
}

function extractDescriptorsWithSax(content: string): Promise<DescriptorInfo[]> {
    return new Promise((resolve) => {
        const parser = sax.parser(true);
        const descriptors: DescriptorInfo[] = [];

        parser.onopentag = (node) => {
            if (node.name === 'descriptor') {
                const id = node.attributes.id as string | undefined;
                const type = (node.attributes.type as string) || DEFAULT_DESCRIPTOR_TYPE;
                if (id) {
                    descriptors.push({ id, type });
                }
            }
        };

        parser.onend = () => resolve(descriptors);
        parser.onerror = () => parser.resume();

        parser.write(content).close();
    });
}
