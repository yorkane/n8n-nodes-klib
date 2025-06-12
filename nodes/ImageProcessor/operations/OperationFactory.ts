import { IImageOperation } from './types';
import { ConvertOperation } from './ConvertOperation';
import { GetImageInfoOperation } from './GetImageInfoOperation';
import { ResizeOperation } from './ResizeOperation';
import { CropOperation } from './CropOperation';

export class OperationFactory {
    private static operations: Map<string, () => IImageOperation> = new Map([
        ['convert', () => new ConvertOperation()],
        ['getImageInfo', () => new GetImageInfoOperation()],
        ['resize', () => new ResizeOperation()],
        ['crop', () => new CropOperation()],
    ]);

    static createOperation(operationType: string): IImageOperation {
        const operationCreator = this.operations.get(operationType);
        if (!operationCreator) {
            throw new Error(`不支持的操作类型: ${operationType}`);
        }
        return operationCreator();
    }

    static getSupportedOperations(): string[] {
        return Array.from(this.operations.keys());
    }
}