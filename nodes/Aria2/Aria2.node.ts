import { INodeType, INodeTypeDescription, ITriggerFunctions, ITriggerResponse } from 'n8n-workflow';
import { WebSocket } from 'ws';

class Aria2 implements INodeType {
    description: INodeTypeDescription = {
        displayName: 'Aria2 Trigger',
        name: 'aria2',
        icon: 'file:Aria2.svg',
        group: ['trigger'],
        version: 1,
        description: 'Trigger on Aria2 events via WebSocket',
        defaults: {
            name: 'Aria2 Trigger',
        },
        credentials: [
            {
                name: 'aria2Api',
                required: true,
            },
        ],
        inputs: [],
        outputs: ['main'],
        properties: [
            {
                displayName: 'Events',
                name: 'events',
                type: 'multiOptions',
                options: [
                    {
                        name: 'Download Started',
                        value: 'downloadStart',
                    },
                    {
                        name: 'Download Paused',
                        value: 'downloadPause',
                    },
                    {
                        name: 'Download Stopped',
                        value: 'downloadStop',
                    },
                    {
                        name: 'Download Complete',
                        value: 'downloadComplete',
                    },
                    {
                        name: 'Download Error',
                        value: 'downloadError',
                    },
                ],
                default: ['downloadStart', 'downloadComplete'],
                required: true,
                description: 'The events to listen for',
            },
        ],
    };

    async trigger(this: ITriggerFunctions): Promise<ITriggerResponse | undefined> {
        const credentials = await this.getCredentials('aria2Api');
        const events = this.getNodeParameter('events') as string[];

        let ws: WebSocket | null = null;

        const startTrigger = async () => {
            ws = new WebSocket(credentials.wsUrl as string);

            ws.on('open', () => {
                console.log('Connected to Aria2 WebSocket');
                const subscribeMessage = {
                    jsonrpc: '2.0',
                    method: 'aria2.onDownloadStart',
                    params: [`token:${credentials.secret}`],
                };
                ws?.send(JSON.stringify(subscribeMessage));
            });

            ws.on('message', (data) => {
                try {
                    const message = JSON.parse(data.toString());
                    if (message.method) {
                        const eventType = message.method.split('.').pop();
                        if (events.includes(eventType)) {
                            this.emit([[{
                                json: {
                                    event: eventType,
                                    data: message.params,
                                },
                            }]]);
                        }
                    }
                } catch (error) {
                    console.error('Error processing WebSocket message:', error);
                }
            });

            ws.on('error', (error) => {
                console.error('WebSocket error:', error);
            });

            ws.on('close', () => {
                console.log('WebSocket connection closed');
            });
        };

        const stopTrigger = async () => {
            if (ws) {
                ws.close();
                ws = null;
            }
        };

        await startTrigger();

        return {
            closeFunction: stopTrigger,
        };
    }
}

export { Aria2 }; 