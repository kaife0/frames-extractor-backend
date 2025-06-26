import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from 'ffmpeg-static';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';

// Set ffmpeg path
if (ffmpegPath) {
  ffmpeg.setFfmpegPath(ffmpegPath);
}

export interface VideoMetadata {
  id: string;
  name: string;
  size: number;
  duration?: number;
  width?: number;
  height?: number;
  uploadTime: Date;
  framePath: string;
}

export interface FrameData {
  id: string;
  videoId: string;
  timestamp: number;
  filename: string;
  path: string;
  features?: number[];
}

export class VideoService {
  private uploadDir: string;
  private framesDir: string;

  constructor(uploadDir: string, framesDir: string) {
    this.uploadDir = uploadDir;
    this.framesDir = framesDir;
  }

  async extractFrames(videoPath: string, videoId: string, interval: number = 1): Promise<FrameData[]> {
    const videoFramesDir = path.join(this.framesDir, videoId);
    
    // Create directory for this video's frames
    if (!fs.existsSync(videoFramesDir)) {
      fs.mkdirSync(videoFramesDir, { recursive: true });
    }

    return new Promise((resolve, reject) => {
      const frames: FrameData[] = [];
      let frameCount = 0;

      ffmpeg(videoPath)
        .outputOptions([
          `-vf fps=1/${interval}`, // Extract frame every N seconds
          '-y' // Overwrite output files
        ])
        .output(path.join(videoFramesDir, 'frame_%04d.png'))
        .on('start', (commandLine) => {
          console.log('Spawned FFmpeg with command: ' + commandLine);
        })
        .on('progress', (progress) => {
          console.log('Processing: ' + progress.percent + '% done');
        })
        .on('end', async () => {
          try {
            // Read generated frames
            const frameFiles = fs.readdirSync(videoFramesDir)
              .filter(file => file.endsWith('.png'))
              .sort();

            console.log(`Found ${frameFiles.length} frame files in ${videoFramesDir}`);

            for (const [index, filename] of frameFiles.entries()) {
              const frameId = `${videoId}_frame_${String(index + 1).padStart(4, '0')}`;
              const framePath = path.join(videoFramesDir, filename);
              const timestamp = index * interval;

              console.log(`Processing frame: ${filename}, path: ${framePath}`);

              frames.push({
                id: frameId,
                videoId,
                timestamp,
                filename,
                path: framePath
              });
            }

            console.log(`Successfully processed ${frames.length} frames`);
            resolve(frames);
          } catch (error) {
            console.error('Error processing frames:', error);
            reject(error);
          }
        })
        .on('error', (err) => {
          console.error('FFmpeg error:', err);
          reject(err);
        })
        .run();
    });
  }

  async getVideoMetadata(videoPath: string): Promise<Partial<VideoMetadata>> {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(videoPath, (err, metadata) => {
        if (err) {
          reject(err);
          return;
        }

        const videoStream = metadata.streams.find(stream => stream.codec_type === 'video');
        
        resolve({
          duration: metadata.format.duration || 0,
          width: videoStream?.width || 0,
          height: videoStream?.height || 0,
          size: metadata.format.size || 0
        });
      });
    });
  }

  validateVideoFile(file: Express.Multer.File): boolean {
    const allowedTypes = (process.env.ALLOWED_VIDEO_TYPES || 'video/mp4,video/avi,video/mov').split(',');
    return allowedTypes.includes(file.mimetype);
  }
}
