import { ICredentialType, INodeProperties } from 'n8n-workflow';

export class Aria2Api implements ICredentialType {
    name = 'aria2Api';
    displayName = 'Aria2 API';
    documentationUrl = 'aria2';
    properties: INodeProperties[] = [
        {
            displayName: 'WebSocket URL',
            name: 'wsUrl',
            type: 'string',
            default: 'ws://localhost:6800/jsonrpc',
            required: true,
        },
        {
            displayName: 'Secret Token',
            name: 'secret',
            type: 'string',
            typeOptions: {
                password: true,
            },
            default: '',
        },
    ];
} 