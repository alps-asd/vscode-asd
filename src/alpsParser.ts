import * as xml2js from 'xml2js';
import * as sax from 'sax';

export interface DescriptorInfo {
    id: string;
    type: string;
}

export async function parseAlpsProfile(content: string): Promise<DescriptorInfo[]> {
    try {
        const result = await xml2js.parseStringPromise(content);
        const descriptors = result.alps?.descriptor
            ?.map((desc: any) => ({
                id: desc.$.id,
                type: desc.$.type || 'semantic'
            })) || [];
        console.log('Extracted descriptors (XML parsing):', descriptors);
        if (descriptors.length > 0) {
            return descriptors;
        }
        return extractDescriptors(content);
    } catch (err) {
        console.error('Error parsing ALPS profile:', err);
        return extractDescriptors(content);
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
