import { ITriggerFunctions } from 'n8n-workflow';
import {
	INodeType,
	INodeTypeDescription,
	ITriggerResponse,
	NodeOperationError,
} from 'n8n-workflow';
import { SimpleConsumer } from 'rocketmq-client-nodejs';

export class RocketMQTrigger implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'RocketMQ Trigger',
		name: 'rocketMQTrigger',
		icon: 'file:rocketmq.svg',
		group: ['trigger'],
		version: 1,
		description: 'Starts the workflow when RocketMQ events occur',
		defaults: {
			name: 'RocketMQ Trigger',
		},
		inputs: [],
		outputs: ['main'],
		credentials: [
			{
				name: 'rocketMQApi',
				required: true,
			},
		],
		properties: [
			{
				displayName: 'Topic',
				name: 'topic',
				type: 'string',
				default: '',
				required: true,
				description: 'Name of the topic to consume from',
			},
			{
				displayName: 'Consumer Group',
				name: 'consumerGroup',
				type: 'string',
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

	async trigger(this: ITriggerFunctions): Promise<ITriggerResponse> {
		const nameServer = this.getNodeParameter('nameServer') as string;
		const topic = this.getNodeParameter('topic') as string;
		const consumerGroup = this.getNodeParameter('consumerGroup') as string;
		const tag = this.getNodeParameter('tag') as string;

		const consumer = new SimpleConsumer({
			endpoints: nameServer,
			namespace: '',
			consumerGroup,
			subscriptions: new Map().set(topic, tag),
		});

		try {
			await consumer.startup();

			const closeFunction = async () => {
				await consumer.shutdown();
			};

			// Start message polling in background
			setImmediate(async () => {
				try {
					while (true) {
						const messages = await consumer.receive(20);
						for (const message of messages) {
							try {
								this.emit([this.helpers.returnJsonArray([{
									topic: message.topic,
									tags: message.tag,
									keys: message.keys,
									body: message.body.toString(),
									msgId: message.messageId,
								}])]);
								await consumer.ack(message);
							} catch (error) {
								await consumer.ack(message);
								console.error('Error processing message:', error);
							}
						}
					}
				} catch (error) {
					console.error('Consumer error:', error);
					await closeFunction();
				}
			});

			return {
				closeFunction,
			};
		} catch (error) {
			throw new NodeOperationError(this.getNode(), error);
		}
	}
} 