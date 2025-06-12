import type { INodeParameters } from 'n8n-workflow';

/**
 * Configures the outputs of the FileDetect node based on the parameters
 */
export const configuredOutputs = (parameters: INodeParameters) => {
	const mode = parameters.mode as string;

	if (mode === 'simple') {
		// Simple mode has just one output
		return [
			{
				type: 'main',
				displayName: 'Result',
			},
		];
	} else if (mode === 'route') {
		// Route mode has two outputs: True and False
		return [
			{
				type: 'main',
				displayName: 'True',
			},
			{
				type: 'main',
				displayName: 'False',
			},
		];
	}

	// Default output if no valid mode is selected
	return [
		{
			type: 'main',
			displayName: 'Result',
		},
	];
};