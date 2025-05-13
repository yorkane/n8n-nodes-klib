import type { IExecuteFunctions } from 'n8n-workflow';
import {
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	NodeOperationError,
} from 'n8n-workflow';
import { Producer } from 'rocketmq-client-nodejs';

export class RocketMQ implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'RocketMQ',
		name: 'rocketMQ',
		icon: 'file:rocketmq.svg',
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["topic"]}}',
		description: 'Send and receive messages via RocketMQ',
		defaults: {
			name: 'RocketMQ',
		},
		inputs: ['main'],
		outputs: ['main'],
		credentials: [
			{
				name: 'rocketMQApi',
				required: true,
			},
		],
		properties: [
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				options: [
					{
						name: 'Send Message',
						value: 'sendMessage',
						description: 'Send a message to RocketMQ topic',
						action: 'Send a message to RocketMQ topic',
					},
					{
						name: 'Consume Message',
						value: 'consumeMessage',
						description: 'Consume messages from RocketMQ topic',
						action: 'Consume messages from RocketMQ topic',
					},
				],
				default: 'sendMessage',
			},
			{
				displayName: 'Topic',
				name: 'topic',
				type: 'string',
				default: '',
				required: true,
				description: 'Name of the topic to send messages to or consume from',
			},
			{
				displayName: 'Message',
				name: 'message',
				type: 'string',
				displayOptions: {
					show: {
						operation: ['sendMessage'],
					},
				},
				default: '',
				required: true,
				description: 'Message to send',
			},
			{
				displayName: 'Consumer Group',
				name: 'consumerGroup',
				type: 'string',
				displayOptions: {
					show: {
						operation: ['consumeMessage'],
					},
				},
				default: '',
				required: true,
				description: 'Consumer group name',
			},
			{
				displayName: 'Tag',
				name: 'tag',
				type: 'string',
				default: '',
				required: false,
				description: 'Message tag (optional)',
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];
		const nameServer = this.getNodeParameter('nameServer', 0) as string;
		
		const producer = new Producer({
			endpoints: nameServer,
			namespace: '',
		});

		try {
			await producer.startup();

			for (let i = 0; i < items.length; i++) {
				const topic = this.getNodeParameter('topic', i) as string;
				const message = this.getNodeParameter('message', i) as string;
				const tags = this.getNodeParameter('tags', i) as string;
				const keys = this.getNodeParameter('keys', i) as string;

				const receipt = await producer.send({
					topic,
					tag: tags,
					keys: [keys],
					body: Buffer.from(message),
				});

				returnData.push({
					json: {
						messageId: receipt.messageId,
						transactionId: receipt.transactionId,
					},
				});
			}

			await producer.shutdown();
			
			return [returnData];
		} catch (error) {
			throw new NodeOperationError(this.getNode(), error);
		}
	}
}
