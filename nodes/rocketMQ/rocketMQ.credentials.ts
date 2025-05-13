import {
	IAuthenticateGeneric,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class RocketMQApi implements ICredentialType {
	name = 'rocketMQApi';
	displayName = 'RocketMQ API';
	properties: INodeProperties[] = [
		{
			displayName: 'Endpoints',
			name: 'endpoints',
			type: 'string',
			default: '',
			required: true,
			description: 'Comma-separated list of RocketMQ endpoints',
		},
		{
			displayName: 'Access Key',
			name: 'accessKey',
			type: 'string',
			default: '',
			required: true,
		},
		{
			displayName: 'Secret Key',
			name: 'secretKey',
			type: 'string',
			typeOptions: {
				password: true,
			},
			default: '',
			required: true,
		},
	];
} 