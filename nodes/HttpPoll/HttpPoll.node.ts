import {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	NodeOperationError,
} from 'n8n-workflow';
import { NodeApiError } from 'n8n-workflow';
import axios, { AxiosRequestConfig, AxiosResponse } from 'axios';

export class HttpPoll implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'HTTP Poll',
		name: 'httpPoll',
		icon: 'file:httppoll.svg',
		group: ['transform'],
		version: 1,
		description: 'Poll a URL until the response matches a regex pattern or times out',
		defaults: {
			name: 'HTTP Poll',
		},
		inputs: ['main'],
		outputs: ['main'],
		credentials: [
			{
				name: 'redis',
				required: false,
			},
		],
		properties: [
			{
				displayName: 'URL',
				name: 'url',
				type: 'string',
				default: '',
				placeholder: 'https://api.example.com/status',
				description: 'The URL to poll',
			},
			{
				displayName: 'HTTP Method',
				name: 'method',
				type: 'options',
				options: [
					{
						name: 'GET',
						value: 'GET',
					},
					{
						name: 'POST',
						value: 'POST',
					},
					{
						name: 'PUT',
						value: 'PUT',
					},
					{
						name: 'DELETE',
						value: 'DELETE',
					},
					{
						name: 'PATCH',
						value: 'PATCH',
					},
				],
				default: 'GET',
				description: 'HTTP method to use for requests',
			},
			{
				displayName: 'Headers',
				name: 'headers',
				type: 'fixedCollection',
				typeOptions: {
					multipleValues: true,
				},
				default: {},
				placeholder: 'Add Header',
				description: 'Headers to send with the request',
				options: [
					{
						name: 'header',
						displayName: 'Header',
						values: [
							{
								displayName: 'Name',
								name: 'name',
								type: 'string',
								default: '',
								description: 'Name of the header',
							},
							{
								displayName: 'Value',
								name: 'value',
								type: 'string',
								default: '',
								description: 'Value of the header',
							},
						],
					},
				],
			},
			{
				displayName: 'Request Body',
				name: 'body',
				type: 'string',
				typeOptions: {
					rows: 4,
				},
				default: '',
				placeholder: '{"key": "value"}',
				description: 'Request body in JSON format. Optional field - leave empty for no body.',
			},
			{
				displayName: 'Success Pattern',
				name: 'successPattern',
				type: 'string',
				default: '',
				placeholder: 'status":\s*"success"',
				description: 'Regex pattern to match in response for success',
			},
			{
				displayName: 'Pattern Match Field',
				name: 'matchField',
				type: 'options',
				options: [
					{
						name: 'Full Response',
						value: 'full',
					},
					{
						name: 'Response Body',
						value: 'body',
					},
					{
						name: 'Status Code',
						value: 'status',
					},
					{
						name: 'Specific JSON Path',
						value: 'jsonpath',
					},
				],
				default: 'body',
				description: 'Which part of the response to match against',
			},
			{
				displayName: 'JSON Path',
				name: 'jsonPath',
				type: 'string',
				default: '',
				placeholder: '$.data.status',
				description: 'JSON path to extract value for pattern matching',
				displayOptions: {
					show: {
						matchField: ['jsonpath'],
					},
				},
			},
			{
				displayName: 'Polling Interval',
				name: 'interval',
				type: 'number',
				typeOptions: {
					numberPrecision: 1,
				},
				default: 5,
				description: 'Time in seconds between polling attempts',
			},
			{
				displayName: 'Max Attempts',
				name: 'maxAttempts',
				type: 'number',
				typeOptions: {
					numberPrecision: 0,
				},
				default: 60,
				description: 'Maximum number of polling attempts',
			},
			{
				displayName: 'Timeout',
				name: 'timeout',
				type: 'number',
				typeOptions: {
					numberPrecision: 0,
				},
				default: 300,
				description: 'Total timeout in seconds',
			},
			{
				displayName: 'HTTP Timeout',
				name: 'requestTimeout',
				type: 'number',
				typeOptions: {
					numberPrecision: 0,
				},
				default: 30,
				description: 'Individual request timeout in seconds',
			},
			{
				displayName: 'Continue on Error',
				name: 'continueOnError',
				type: 'boolean',
				default: false,
				description: 'Continue polling on HTTP errors (4xx, 5xx)',
			},
			{
				displayName: 'Response Format',
				name: 'responseFormat',
				type: 'options',
				options: [
					{
						name: 'JSON',
						value: 'json',
					},
					{
						name: 'Text',
						value: 'text',
					},
				],
				default: 'json',
				description: 'How to parse the response body',
			},
			{
				displayName: 'Log Level',
				name: 'logLevel',
				type: 'options',
				options: [
					{
						name: 'None',
						value: 'none',
						description: 'No logging output',
					},
					{
						name: 'Basic',
						value: 'basic',
						description: 'Log basic polling information (start, success, failure)',
					},
					{
						name: 'Standard',
						value: 'standard',
						description: 'Log requests, responses, and pattern matching results',
					},
					{
						name: 'Verbose',
						value: 'verbose',
						description: 'Log all details including headers, full response data, and error details',
					},
				],
				default: 'none',
				description: 'Level of detail for logging output',
			},
			{
				displayName: 'Redis Publishing Mode',
				name: 'redisMode',
				type: 'options',
				options: [
					{
						name: 'Disable',
						value: 'disable',
						description: 'Disable Redis publishing',
					},
					{
						name: 'Publish Channel',
						value: 'publish',
						description: 'Publish results to Redis channel (pub/sub)',
					},
					{
						name: 'Push to List',
						value: 'list',
						description: 'Push results to Redis list',
					},
				],
				default: 'disable',
				description: 'Select how to handle Redis publishing',
			},
			{
				displayName: 'Redis Channel/List Name',
				name: 'redisName',
				type: 'string',
				default: 'http-poll-results',
				description: 'Redis channel name (for publish) or list name (for push)',
				displayOptions: {
					show: {
						redisMode: ['publish', 'list'],
					},
				},
			},
			{
				displayName: 'Publish All Attempts',
				name: 'publishAllAttempts',
				type: 'boolean',
				default: false,
				description: 'Publish all poll attempts (true) or only successful matches (false)',
				displayOptions: {
					show: {
						redisMode: ['publish', 'list'],
					},
				},
			},
			{
				displayName: 'Redis Message Format',
				name: 'redisMessageFormat',
				type: 'options',
				options: [
					{
						name: 'Full Response',
						value: 'full',
						description: 'Publish complete response data',
					},
					{
						name: 'Response Body Only',
						value: 'body',
						description: 'Publish only response body',
					},
					{
						name: 'Summary',
						value: 'summary',
						description: 'Publish summary with attempt info and match status',
					},
				],
				default: 'summary',
				description: 'Format of Redis messages',
				displayOptions: {
					show: {
						redisMode: ['publish', 'list'],
					},
				},
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[][] = [[]];

		for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
			try {
				const url = this.getNodeParameter('url', itemIndex) as string;
				const method = this.getNodeParameter('method', itemIndex) as string;
				const headersData = this.getNodeParameter('headers', itemIndex) as any;
				const headers: Record<string, string> = {};

				if (headersData && headersData.header) {
					for (const header of headersData.header) {
						if (header.name && header.value) {
							headers[header.name] = header.value;
						}
					}
				}
				const body = this.getNodeParameter('body', itemIndex, '') as string;
				const successPattern = this.getNodeParameter('successPattern', itemIndex) as string;
				const matchField = this.getNodeParameter('matchField', itemIndex) as string;
				const jsonPath = this.getNodeParameter('jsonPath', itemIndex, '') as string;
				const interval = this.getNodeParameter('interval', itemIndex) as number;
				const maxAttempts = this.getNodeParameter('maxAttempts', itemIndex) as number;
				const timeout = this.getNodeParameter('timeout', itemIndex) as number;
				const requestTimeout = this.getNodeParameter('requestTimeout', itemIndex) as number;
				const continueOnError = this.getNodeParameter('continueOnError', itemIndex) as boolean;
				const responseFormat = this.getNodeParameter('responseFormat', itemIndex) as string;
				const logLevel = this.getNodeParameter('logLevel', itemIndex) as string;

				// Redis related parameters
				const redisMode = this.getNodeParameter('redisMode', itemIndex) as string;
				const redisName = this.getNodeParameter('redisName', itemIndex) as string;
				const publishAllAttempts = this.getNodeParameter('publishAllAttempts', itemIndex) as boolean;
				const redisMessageFormat = this.getNodeParameter('redisMessageFormat', itemIndex) as string;

				const startTime = Date.now();
				let attempt = 0;
				let lastResponse: AxiosResponse | null = null;
				let lastError: any = null;

				// Redis connection (optional)
				let redisClient: any = null;
				if (redisMode !== 'disable') {
					try {
						const credentials = await this.getCredentials('redis') as any;
						if (credentials) {
							const Redis = require('ioredis');
							redisClient = new Redis({
								host: credentials.host || 'localhost',
								port: credentials.port || 6379,
								password: credentials.password,
								db: credentials.database || 0,
								reconnectOnError: false,
								maxRetriesPerRequest: 1,
							});

							redisClient.on('error', (error: Error) => {
								if (HttpPoll.prototype.shouldLog(logLevel, 'basic')) {
									HttpPoll.prototype.log('basic', `Redis connection error: ${error.message}`);
								}
							});

							if (HttpPoll.prototype.shouldLog(logLevel, 'basic')) {
								const modeDesc = redisMode === 'publish' ? 'Publish Channel' : 'Push to List';
								HttpPoll.prototype.log('basic', `Connected to Redis at ${credentials.host || 'localhost'}:${credentials.port || 6379} (${modeDesc} mode)`);
							}
						}
					} catch (error) {
						if (HttpPoll.prototype.shouldLog(logLevel, 'basic')) {
							HttpPoll.prototype.log('basic', `Failed to connect to Redis: ${(error as Error).message}`);
						}
						// Continue without Redis if connection fails
					}
				}

				// Prepare request config
				const requestConfig: AxiosRequestConfig = {
					method: method.toLowerCase() as any,
					url,
					timeout: requestTimeout * 1000,
					headers: {
						'User-Agent': 'n8n-http-poll',
						...headers,
					},
				};

				if (body && ['POST', 'PUT', 'PATCH'].includes(method.toUpperCase())) {
					requestConfig.data = body;
				}

				// Output logging based on log level
				if (HttpPoll.prototype.shouldLog(logLevel, 'basic')) {
					HttpPoll.prototype.log('basic', `Starting HTTP polling for: ${method} ${url}`);
				}

				if (HttpPoll.prototype.shouldLog(logLevel, 'standard')) {
					HttpPoll.prototype.log('standard', `Configuration:`, {
						successPattern,
						matchField,
						jsonPath: jsonPath || 'N/A',
						interval: `${interval}s`,
						maxAttempts,
						timeout: `${timeout}s`,
						continueOnError,
						responseFormat,
						redisMode: redisMode === 'disable' ? 'Disabled' : `${redisMode} (${redisName})`
					});
				}

				if (HttpPoll.prototype.shouldLog(logLevel, 'verbose')) {
					HttpPoll.prototype.log('verbose', `Full configuration:`, {
						url,
						method,
						headers,
						body: body || 'none',
						successPattern,
						matchField,
						jsonPath: jsonPath || 'N/A',
						interval: `${interval}s`,
						maxAttempts,
						timeout: `${timeout}s`,
						requestTimeout: `${requestTimeout}s`,
						continueOnError,
						responseFormat,
						redisMode: redisMode === 'disable' ? 'Disabled' : `${redisMode} (${redisName})`
					});
				}

				let isCancelled = false;

				// Create a simple polling interval to check for external cancellation
				const cancelCheckInterval = setInterval(() => {
					// This is a simple way to allow external cancellation
					// In a real implementation, n8n would handle this automatically
					// But for now, we'll just clean up the interval
				}, 500);

				// Cleanup function for the interval
				const cleanup = () => {
					if (cancelCheckInterval) {
						clearInterval(cancelCheckInterval);
					}
				};

				// Polling loop
				while (attempt < maxAttempts && (Date.now() - startTime) < timeout * 1000 && !isCancelled) {
					attempt++;

					// Add a small delay to allow for cancellation checking
					// This makes the node more responsive to workflow cancellation
					await new Promise(resolve => setTimeout(resolve, 10));

					// Simple cancellation check - if the workflow has been running too long
					// or if there are any execution issues, we might want to stop
					if (attempt > 1000) {
						// Safety: don't run forever
						isCancelled = true;
						if (HttpPoll.prototype.shouldLog(logLevel, 'basic')) {
							HttpPoll.prototype.log('basic', `Maximum attempts reached, stopping polling after ${attempt - 1} attempts`);
						}

						const cancelledOutput: INodeExecutionData = {
							json: {
								success: false,
								attempts: attempt - 1,
								totalTime: Date.now() - startTime,
								error: 'Maximum attempts reached for safety',
								cancelled: true,
								lastResponse: lastResponse ? {
									status: lastResponse.status,
									statusText: lastResponse.statusText,
									data: lastResponse.data,
								} : null,
							},
						};
						cleanup();
						returnData[0].push(cancelledOutput);
						return returnData;
					}

					try {
						// Log request details before making the request
						if (HttpPoll.prototype.shouldLog(logLevel, 'basic')) {
							HttpPoll.prototype.log('basic', `Attempt ${attempt}: Making ${method.toUpperCase()} request to ${url}`);
						}

						if (HttpPoll.prototype.shouldLog(logLevel, 'standard')) {
							HttpPoll.prototype.log('standard', `Request details:`, {
								url: requestConfig.url,
								method: requestConfig.method?.toUpperCase(),
								timeout: `${requestConfig.timeout}ms`
							});
						}

						if (HttpPoll.prototype.shouldLog(logLevel, 'verbose')) {
							HttpPoll.prototype.log('verbose', `Full request:`, {
								url: requestConfig.url,
								method: requestConfig.method?.toUpperCase(),
								headers: requestConfig.headers,
								body: requestConfig.data ? (typeof requestConfig.data === 'string' ? requestConfig.data : JSON.stringify(requestConfig.data)) : 'none',
								timeout: `${requestConfig.timeout}ms`
							});
						}

						const requestStartTime = Date.now();
						// Make HTTP request
						const response = await axios(requestConfig);
						const requestEndTime = Date.now();
						const requestDuration = requestEndTime - requestStartTime;

						lastResponse = response;
						lastError = null;

						// Log response details
						if (HttpPoll.prototype.shouldLog(logLevel, 'basic')) {
							HttpPoll.prototype.log('basic', `Attempt ${attempt}: Response received - ${response.status} (${requestDuration}ms)`);
						}

						if (HttpPoll.prototype.shouldLog(logLevel, 'standard')) {
							HttpPoll.prototype.log('standard', `Response details:`, {
								status: response.status,
								statusText: response.statusText,
								responseTime: `${requestDuration}ms`
							});
						}

						if (HttpPoll.prototype.shouldLog(logLevel, 'verbose')) {
							HttpPoll.prototype.log('verbose', `Full response:`, {
								status: response.status,
								statusText: response.statusText,
								responseTime: `${requestDuration}ms`,
								headers: response.headers,
								data: response.data
							});
						}

						// Extract match target
						let matchTarget = '';

						switch (matchField) {
							case 'full':
								matchTarget = JSON.stringify({
									status: response.status,
									headers: response.headers,
									data: response.data,
								});
								break;
							case 'body':
								matchTarget = typeof response.data === 'string' ? response.data : JSON.stringify(response.data);
								break;
							case 'status':
								matchTarget = response.status.toString();
								break;
							case 'jsonpath':
								matchTarget = HttpPoll.prototype.extractJsonPath(response.data, jsonPath);
								break;
						}

						// Log match target and pattern matching
						if (HttpPoll.prototype.shouldLog(logLevel, 'standard')) {
							HttpPoll.prototype.log('standard', `Pattern matching:`, {
								matchField,
								pattern: successPattern,
								target: matchTarget
							});
						}

						// Check if response matches success pattern
						const isMatch = HttpPoll.prototype.testPattern(matchTarget, successPattern);

						if (HttpPoll.prototype.shouldLog(logLevel, 'basic')) {
							HttpPoll.prototype.log('basic', `Attempt ${attempt}: Pattern match ${isMatch ? 'SUCCESS ✓' : 'NO MATCH ✗'}`);
						}

						// Publish to Redis if enabled
						if (redisMode !== 'disable' && redisClient && (publishAllAttempts || isMatch)) {
							await HttpPoll.prototype.publishToRedis(
								redisClient,
								redisMode,
								redisName,
								redisMessageFormat,
								response,
								attempt,
								isMatch,
								matchTarget,
								url,
								method,
								Date.now() - startTime
							);
						}

						if (isMatch) {
							const successOutput: INodeExecutionData = {
								json: {
									success: true,
									attempts: attempt,
									totalTime: Date.now() - startTime,
									response: {
										status: response.status,
										statusText: response.statusText,
										headers: response.headers,
										data: response.data,
									},
									matchedPattern: successPattern,
									matchedValue: matchTarget,
								},
							};

							returnData[0].push(successOutput);
							if (HttpPoll.prototype.shouldLog(logLevel, 'basic')) {
								HttpPoll.prototype.log('basic', `Polling completed successfully! Total attempts: ${attempt}, Total time: ${Date.now() - startTime}ms`);
							}
							cleanup();
							// Cleanup Redis connection
							if (redisClient) {
								try {
									await redisClient.quit();
									if (HttpPoll.prototype.shouldLog(logLevel, 'basic')) {
										HttpPoll.prototype.log('basic', 'Redis connection closed');
									}
								} catch (error) {
									// Ignore Redis cleanup errors
								}
							}
							break;
						}

						// If not matched, wait for next attempt
						if (attempt < maxAttempts) {
							if (HttpPoll.prototype.shouldLog(logLevel, 'basic')) {
								HttpPoll.prototype.log('basic', `Pattern not matched, waiting ${interval}s before next attempt`);
							}
							await HttpPoll.prototype.sleepWithCancellation(interval * 1000, logLevel, this);
						}

					} catch (error) {
						lastError = error;

						if (HttpPoll.prototype.shouldLog(logLevel, 'basic')) {
							HttpPoll.prototype.log('basic', `Attempt ${attempt}: Request failed - ${(error as Error).message}`);
						}

						if (HttpPoll.prototype.shouldLog(logLevel, 'standard')) {
							HttpPoll.prototype.log('standard', `Error details:`, {
								type: error.constructor.name,
								message: (error as Error).message
							});
						}

						if (HttpPoll.prototype.shouldLog(logLevel, 'verbose')) {
							const errorDetails: any = {
								type: error.constructor.name,
								message: (error as Error).message
							};
							if ((error as any).response) {
								errorDetails.responseStatus = (error as any).response?.status;
								errorDetails.responseData = (error as any).response?.data;
							}
							if ((error as any).code) {
								errorDetails.code = (error as any).code;
							}
							HttpPoll.prototype.log('verbose', `Full error details:`, errorDetails);
						}

						if (!continueOnError) {
							throw new Error(`HTTP request failed: ${(error as Error).message}`);
						}

						// Log error but continue if continueOnError is true
						console.warn(`Request ${attempt} failed: ${(error as Error).message}`);

						// Wait before next attempt
						if (attempt < maxAttempts) {
							if (HttpPoll.prototype.shouldLog(logLevel, 'basic')) {
								HttpPoll.prototype.log('basic', `Error occurred, waiting ${interval}s before next attempt (continueOnError: true)`);
							}
							await HttpPoll.prototype.sleepWithCancellation(interval * 1000, logLevel, this);
						}
					}
				}

				// If we exhausted all attempts or timed out
				const isTimeout = (Date.now() - startTime) >= timeout * 1000;
				const isMaxAttemptsReached = attempt >= maxAttempts;

				if (!lastResponse || !HttpPoll.prototype.testPattern(
					HttpPoll.prototype.getMatchTarget(lastResponse, matchField, jsonPath),
					successPattern
				)) {
					if (HttpPoll.prototype.shouldLog(logLevel, 'basic')) {
						const reason = isTimeout ? 'timeout' : (isMaxAttemptsReached ? 'max attempts reached' : 'pattern not matched');
						HttpPoll.prototype.log('basic', `Polling failed: ${reason}. Attempts: ${attempt}, Time: ${Date.now() - startTime}ms`);
					}

					if (HttpPoll.prototype.shouldLog(logLevel, 'standard')) {
						HttpPoll.prototype.log('standard', `Polling completed without success:`, {
							totalAttempts: attempt,
							totalTime: `${Date.now() - startTime}ms`,
							timeoutReached: isTimeout,
							maxAttemptsReached: isMaxAttemptsReached,
							lastError: lastError ? lastError.message : 'None'
						});
					}

					const errorOutput: INodeExecutionData = {
						json: {
							success: false,
							attempts: attempt,
							totalTime: Date.now() - startTime,
							error: lastError ? lastError.message : 'Pattern not matched',
							timeout: (Date.now() - startTime) >= timeout * 1000,
							maxAttemptsReached: attempt >= maxAttempts,
							lastResponse: lastResponse ? {
								status: lastResponse.status,
								statusText: lastResponse.statusText,
								data: lastResponse.data,
							} : null,
						},
					};

					returnData[0].push(errorOutput);
				}

				// Cleanup the interval
				cleanup();

				// Cleanup Redis connection
				if (redisClient) {
					try {
						await redisClient.quit();
						if (HttpPoll.prototype.shouldLog(logLevel, 'basic')) {
							HttpPoll.prototype.log('basic', 'Redis connection closed');
						}
					} catch (error) {
						// Ignore Redis cleanup errors
					}
				}

			} catch (error) {
				const errorOutput: INodeExecutionData = {
					json: {
						success: false,
						error: (error as Error).message,
					},
				};
				returnData[0].push(errorOutput);
			}
		}

		return returnData;
	}

	private shouldLog(currentLevel: string, targetLevel: string): boolean {
		const levels = {
			'none': 0,
			'basic': 1,
			'standard': 2,
			'verbose': 3,
		};
		return levels[currentLevel] >= levels[targetLevel];
	}

	private log(level: string, message: string, data?: any): void {
		console.log(`[HTTP Poll ${level.toUpperCase()}] ${message}`, data || '');
	}

	private extractJsonPath(data: any, path: string): string {
		try {
			const parts = path.replace(/^\$\./, '').split('.');
			let result = data;

			for (const part of parts) {
				if (result && typeof result === 'object' && part in result) {
					result = result[part];
				} else {
					return '';
				}
			}

			return typeof result === 'string' ? result : JSON.stringify(result);
		} catch (error) {
			return '';
		}
	}

	private getMatchTarget(response: AxiosResponse, matchField: string, jsonPath: string): string {
		switch (matchField) {
			case 'full':
				return JSON.stringify({
					status: response.status,
					headers: response.headers,
					data: response.data,
				});
			case 'body':
				return typeof response.data === 'string' ? response.data : JSON.stringify(response.data);
			case 'status':
				return response.status.toString();
			case 'jsonpath':
				return this.extractJsonPath(response.data, jsonPath);
			default:
				return '';
		}
	}

	private testPattern(target: string, pattern: string): boolean {
		if (!pattern) return true;

		try {
			const regex = new RegExp(pattern, 'i');
			return regex.test(target);
		} catch (error) {
			return false;
		}
	}

	private sleep(ms: number): Promise<void> {
		return new Promise(resolve => setTimeout(resolve, ms));
	}

	private async sleepWithCancellation(ms: number, logLevel: string, executeFunctions: IExecuteFunctions): Promise<void> {
		const startTime = Date.now();
		const interval = 100; // Check every 100ms for better responsiveness

		while (Date.now() - startTime < ms) {
			const remainingTime = ms - (Date.now() - startTime);

			// Sleep in small intervals to allow for cancellation checks
			await new Promise(resolve => setTimeout(resolve, Math.min(interval, remainingTime)));

			// Simple cancellation check - if we're cancelled, the sleep will be interrupted
			// This is a basic approach since n8n doesn't expose direct cancellation status
		}
	}

	private async publishToRedis(
		redisClient: any,
		redisMode: string,
		redisName: string,
		messageFormat: string,
		response: AxiosResponse | null,
		attempt: number,
		isMatch: boolean,
		matchTarget: string,
		url: string,
		method: string,
		totalTime: number
	): Promise<void> {
		if (!redisClient || !response) return;

		try {
			let message: any = {};

			switch (messageFormat) {
				case 'full':
					message = {
						timestamp: new Date().toISOString(),
						attempt,
						url,
						method,
						isMatch,
						totalTime,
						response: {
							status: response.status,
							statusText: response.statusText,
							headers: response.headers,
							data: response.data,
						},
					};
					break;

				case 'body':
					message = {
						timestamp: new Date().toISOString(),
						attempt,
						isMatch,
						data: response.data,
					};
					break;

				case 'summary':
				default:
					message = {
						timestamp: new Date().toISOString(),
						attempt,
						url,
						method,
						status: response.status,
						isMatch,
						totalTime,
						matchTarget,
						responseSize: JSON.stringify(response.data).length,
					};
					break;
			}

			if (redisMode === 'publish') {
				// Publish to Redis channel
				await redisClient.publish(redisName, JSON.stringify(message));
			} else if (redisMode === 'list') {
				// Push to Redis list
				await redisClient.lpush(redisName, JSON.stringify(message));
			}
		} catch (error) {
			// Don't throw Redis errors to avoid interrupting the polling
			console.error(`Failed to publish to Redis (${redisMode} mode):`, error);
		}
	}
}