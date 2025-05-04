import { INodeType, INodeTypeDescription, IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import axios from 'axios';

class Aria2Proc implements INodeType {
    description: INodeTypeDescription = {
        displayName: 'Aria2 Download',
        name: 'aria2Proc',
        icon: 'file:Aria2Proc.svg',
        group: ['transform'],
        version: 1,
        description: 'Add downloads to Aria2',
        defaults: {
            name: 'Aria2 Download',
        },
        credentials: [
            {
                name: 'aria2Api',
                required: true,
            },
        ],
        inputs: ['main'],
        outputs: ['main'],
        properties: [
            {
                displayName: 'Download Type',
                name: 'downloadType',
                type: 'options',
                options: [
                    {
                        name: 'HTTP/FTP',
                        value: 'http',
                    },
                    {
                        name: 'Torrent',
                        value: 'torrent',
                    },
                    {
                        name: 'Magnet',
                        value: 'magnet',
                    },
                ],
                default: 'http',
                required: true,
                description: 'The type of download to add',
            },
            {
                displayName: 'URL',
                name: 'url',
                type: 'string',
                default: '',
                required: true,
                description: 'The URL to download',
                displayOptions: {
                    show: {
                        downloadType: ['http', 'torrent'],
                    },
                },
            },
            {
                displayName: 'Magnet URI',
                name: 'magnet',
                type: 'string',
                default: '',
                required: true,
                description: 'The magnet URI to download',
                displayOptions: {
                    show: {
                        downloadType: ['magnet'],
                    },
                },
            },
            {
                displayName: 'Download Directory',
                name: 'dir',
                type: 'string',
                default: '',
                required: false,
                description: 'The directory to save the download',
            },
            {
                displayName: 'File Name',
                name: 'out',
                type: 'string',
                default: '',
                required: false,
                description: 'The name of the file to save as',
            },
        ],
    };

    async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
        const items = this.getInputData();
        const returnData: INodeExecutionData[] = [];

        for (let i = 0; i < items.length; i++) {
            const credentials = await this.getCredentials('aria2Api');
            const downloadType = this.getNodeParameter('downloadType', i) as string;
            const dir = this.getNodeParameter('dir', i) as string;
            const out = this.getNodeParameter('out', i) as string;

            let url = '';
            if (downloadType === 'magnet') {
                url = this.getNodeParameter('magnet', i) as string;
            } else {
                url = this.getNodeParameter('url', i) as string;
            }

            const options: any = {
                method: 'POST',
                url: (credentials.wsUrl as string).replace('ws://', 'http://').replace('wss://', 'https://'),
                headers: {
                    'Content-Type': 'application/json',
                },
                data: {
                    jsonrpc: '2.0',
                    id: 'n8n',
                    method: `aria2.add${downloadType === 'magnet' ? 'Uri' : downloadType === 'torrent' ? 'Torrent' : 'Uri'}`,
                    params: [
                        `token:${credentials.secret}`,
                        [url],
                        {
                            ...(dir && { dir }),
                            ...(out && { out }),
                        },
                    ],
                },
            };

            try {
                const response = await axios(options);
                returnData.push({
                    json: response.data,
                });
            } catch (error) {
                if (axios.isAxiosError(error)) {
                    throw new Error(`Aria2 error: ${error.response?.data?.error?.message || error.message}`);
                }
                throw error;
            }
        }

        return [returnData];
    }
}

export { Aria2Proc }; 