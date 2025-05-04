import { ImageProcessor } from './nodes/ImageProcessor/ImageProcessor.node';
import { Aria2 } from './nodes/Aria2/Aria2.node';
import { Aria2Proc } from './nodes/Aria2/Aria2Proc.node';
import { Aria2Api } from './nodes/Aria2/Aria2Api.credentials';
import { TorrentParse } from './nodes/TorrentParse/TorrentParse.node';

export const nodes = [ImageProcessor, Aria2, Aria2Proc, TorrentParse];
export const credentials = [Aria2Api]; 