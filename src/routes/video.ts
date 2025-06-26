import express, { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { VideoService, VideoMetadata, FrameData } from '../services/videoService';
import { VectorService } from '../services/vectorService';
import { createError } from '../middleware/errorHandler';

const router = express.Router();

// Configure multer for video uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const videoId = uuidv4();
    const extension = path.extname(file.originalname);
    cb(null, `${videoId}${extension}`);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 100 * 1024 * 1024 // 100MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['video/mp4', 'video/avi', 'video/mov', 'video/quicktime', 'video/x-msvideo'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only video files are allowed.'));
    }
  }
});

// Services
const uploadDir = path.join(__dirname, '../../uploads');
const framesDir = path.join(__dirname, '../../frames');
const videoService = new VideoService(uploadDir, framesDir);
const vectorService = new VectorService();

// Video upload endpoint
router.post('/upload', upload.single('video'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.file) {
      throw createError('No video file provided', 400);
    }

    const videoId = path.parse(req.file.filename).name;
    const videoPath = req.file.path;

    // Get video metadata
    const metadata = await videoService.getVideoMetadata(videoPath);

    const videoData: VideoMetadata = {
      id: videoId,
      name: req.file.originalname,
      size: req.file.size,
      uploadTime: new Date(),
      framePath: path.join(framesDir, videoId),
      duration: metadata.duration,
      width: metadata.width,
      height: metadata.height
    };

    res.json({
      status: 'success',
      data: {
        video: videoData
      }
    });
  } catch (error) {
    next(error);
  }
});

// Frame extraction endpoint
router.post('/extract-frames/:videoId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { videoId } = req.params;
    const { interval = 1 } = req.body;

    // Find video file
    const videoFiles = fs.readdirSync(uploadDir).filter(file => file.startsWith(videoId));
    if (videoFiles.length === 0) {
      throw createError('Video not found', 404);
    }

    const videoPath = path.join(uploadDir, videoFiles[0]);

    // Extract frames
    const frames = await videoService.extractFrames(videoPath, videoId, interval);

    // Process frames with vector service (compute features)
    const processedFrames: FrameData[] = [];
    for (const frame of frames) {
      try {
        const processedFrame = await vectorService.processFrame(frame);
        processedFrames.push(processedFrame);
      } catch (error) {
        console.error(`Error processing frame ${frame.id}:`, error);
        // Include frame even if feature extraction failed
        processedFrames.push(frame);
      }
    }

    res.json({
      status: 'success',
      data: {
        frames: processedFrames,
        count: processedFrames.length
      }
    });
  } catch (error) {
    next(error);
  }
});

// Similarity search endpoint
router.post('/search-similar', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { frameId, limit = 10 } = req.body;

    if (!frameId) {
      throw createError('Frame ID is required', 400);
    }

    const similarFrames = await vectorService.findSimilarFrames(frameId, limit);

    res.json({
      status: 'success',
      data: {
        similarFrames,
        count: similarFrames.length
      }
    });
  } catch (error) {
    next(error);
  }
});

// Get video information
router.get('/:videoId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { videoId } = req.params;

    // Find video file
    const videoFiles = fs.readdirSync(uploadDir).filter(file => file.startsWith(videoId));
    if (videoFiles.length === 0) {
      throw createError('Video not found', 404);
    }

    const videoPath = path.join(uploadDir, videoFiles[0]);
    const stats = fs.statSync(videoPath);
    const metadata = await videoService.getVideoMetadata(videoPath);

    const videoData: VideoMetadata = {
      id: videoId,
      name: videoFiles[0],
      size: stats.size,
      uploadTime: stats.birthtime,
      framePath: path.join(framesDir, videoId),
      duration: metadata.duration,
      width: metadata.width,
      height: metadata.height
    };

    res.json({
      status: 'success',
      data: {
        video: videoData
      }
    });
  } catch (error) {
    next(error);
  }
});

// Get frames for a video
router.get('/:videoId/frames', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { videoId } = req.params;
    const videoFramesDir = path.join(framesDir, videoId);

    if (!fs.existsSync(videoFramesDir)) {
      throw createError('No frames found for this video', 404);
    }

    const frameFiles = fs.readdirSync(videoFramesDir)
      .filter(file => file.endsWith('.png'))
      .sort();

    const frames: FrameData[] = frameFiles.map((filename, index) => {
      const frameId = `${videoId}_frame_${String(index + 1).padStart(4, '0')}`;
      return {
        id: frameId,
        videoId,
        timestamp: index, // This would need to be calculated based on extraction interval
        filename,
        path: path.join(videoFramesDir, filename)
      };
    });

    res.json({
      status: 'success',
      data: {
        frames,
        count: frames.length
      }
    });
  } catch (error) {
    next(error);
  }
});

export default router;
