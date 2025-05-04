import { INodeType, INodeTypeDescription, IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { promisify } from 'util';
import { exec } from 'child_process';

const execAsync = promisify(exec);

export class ImageProcessor implements INodeType {
    description: INodeTypeDescription = {
        displayName: 'Image Processor',
        name: 'imageProcessor',
        icon: 'file:ImageProcessor.svg',
        group: ['transform'],
        version: 1,
        description: 'Process images using vipsthumbnail',
        defaults: {
            name: 'Image Processor',
        },
        inputs: ['main'],
        outputs: ['main'],
        properties: [
            {
                displayName: 'Source Path',
                name: 'sourcePath',
                type: 'string',
                default: '',
                required: true,
                description: 'The path of the source image file',
            },
            {
                displayName: 'Target Path',
                name: 'targetPath',
                type: 'string',
                default: '',
                required: true,
                description: 'The path where the processed image will be saved',
            },
            {
                displayName: 'Width',
                name: 'width',
                type: 'number',
                default: 800,
                description: 'The width of the output image',
            },
            {
                displayName: 'Height',
                name: 'height',
                type: 'number',
                default: 600,
                description: 'The height of the output image',
            },
            {
                displayName: 'Format',
                name: 'format',
                type: 'options',
                options: [
                    {
                        name: 'JPEG',
                        value: 'jpeg',
                    },
                    {
                        name: 'PNG',
                        value: 'png',
                    },
                    {
                        name: 'WebP',
                        value: 'webp',
                    },
                ],
                default: 'jpeg',
                description: 'The format of the output image',
            },
            {
                displayName: 'Quality',
                name: 'quality',
                type: 'number',
                default: 80,
                description: 'The quality of the output image (1-100)',
            },
        ],
    };

    async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
        const items = this.getInputData();
        const returnData: INodeExecutionData[] = [];

        for (let i = 0; i < items.length; i++) {
            try {
                const sourcePath = this.getNodeParameter('sourcePath', i) as string;
                const targetPath = this.getNodeParameter('targetPath', i) as string;
                const width = this.getNodeParameter('width', i) as number;
                const height = this.getNodeParameter('height', i) as number;
                const format = this.getNodeParameter('format', i) as string;
                const quality = this.getNodeParameter('quality', i) as number;

                const command = `vipsthumbnail "${sourcePath}" -o "${targetPath}" -s ${width}x${height} -f ${format} -q ${quality}`;
                await execAsync(command);

                returnData.push({
                    json: {
                        sourcePath,
                        targetPath,
                        width,
                        height,
                        format,
                        quality,
                        success: true,
                    },
                });
            } catch (error) {
                if (this.continueOnFail()) {
                    returnData.push({
                        json: {
                            error: error instanceof Error ? error.message : String(error),
                            success: false,
                        },
                    });
                    continue;
                }
                throw error;
            }
        }

        return [returnData];
    }
} 