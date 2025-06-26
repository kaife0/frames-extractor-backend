import sharp from 'sharp';
import { QdrantClient } from '@qdrant/js-client-rest';
import { FrameData } from './videoService';

export interface SimilarFrame {
  frame: FrameData;
  score: number;
}

export class VectorService {
  private qdrantClient: QdrantClient | null = null;
  private inMemoryVectors: Map<string, { frame: FrameData; features: number[] }> = new Map();
  private collectionName = 'frame_vectors';

  constructor() {
    this.initializeQdrant();
  }

  private async initializeQdrant(): Promise<void> {
    try {
      if (process.env.QDRANT_URL) {
        this.qdrantClient = new QdrantClient({
          url: process.env.QDRANT_URL,
          apiKey: process.env.QDRANT_API_KEY
        });

        // Test connection and create collection if needed
        await this.ensureCollection();
        console.log('Qdrant client initialized successfully');
      } else {
        console.log('Qdrant URL not provided, using in-memory storage');
      }
    } catch (error) {
      console.error('Failed to initialize Qdrant client:', error);
      console.log('Falling back to in-memory storage');
      this.qdrantClient = null;
    }
  }

  private async ensureCollection(): Promise<void> {
    if (!this.qdrantClient) return;

    try {
      const collections = await this.qdrantClient.getCollections();
      const collectionExists = collections.collections.some(
        (col: any) => col.name === this.collectionName
      );

      if (!collectionExists) {
        await this.qdrantClient.createCollection(this.collectionName, {
          vectors: {
            size: 192, // RGB histograms: 64 bins × 3 channels
            distance: 'Cosine'
          }
        });
        console.log(`Created collection: ${this.collectionName}`);
      }
    } catch (error) {
      console.error('Error ensuring collection exists:', error);
      throw error;
    }
  }

  async computeColorHistogram(imagePath: string): Promise<number[]> {
    try {
      const image = sharp(imagePath);
      const { data, info } = await image
        .resize(256, 256) // Normalize size
        .raw()
        .toBuffer({ resolveWithObject: true });

      // Compute RGB histograms (64 bins each)
      const rHist = new Array(64).fill(0);
      const gHist = new Array(64).fill(0);
      const bHist = new Array(64).fill(0);

      for (let i = 0; i < data.length; i += info.channels) {
        const r = Math.floor((data[i] / 255) * 63);
        const g = Math.floor((data[i + 1] / 255) * 63);
        const b = Math.floor((data[i + 2] / 255) * 63);

        rHist[r]++;
        gHist[g]++;
        bHist[b]++;
      }

      // Normalize histograms
      const totalPixels = info.width * info.height;
      const normalizedHist = [
        ...rHist.map(count => count / totalPixels),
        ...gHist.map(count => count / totalPixels),
        ...bHist.map(count => count / totalPixels)
      ];

      return normalizedHist;
    } catch (error) {
      console.error('Error computing color histogram:', error);
      throw error;
    }
  }

  async storeFrameVector(frame: FrameData, features: number[]): Promise<void> {
    if (this.qdrantClient) {
      try {
        await this.qdrantClient.upsert(this.collectionName, {
          wait: true,
          points: [{
            id: frame.id,
            vector: features,
            payload: {
              videoId: frame.videoId,
              timestamp: frame.timestamp,
              filename: frame.filename,
              path: frame.path
            }
          }]
        });
      } catch (error) {
        console.error('Error storing vector in Qdrant:', error);
        // Fallback to in-memory storage
        this.inMemoryVectors.set(frame.id, { frame, features });
      }
    } else {
      // In-memory storage
      this.inMemoryVectors.set(frame.id, { frame, features });
    }
  }

  private cosineSimilarity(vecA: number[], vecB: number[]): number {
    const dotProduct = vecA.reduce((sum, a, i) => sum + a * vecB[i], 0);
    const magnitudeA = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0));
    const magnitudeB = Math.sqrt(vecB.reduce((sum, b) => sum + b * b, 0));
    
    return dotProduct / (magnitudeA * magnitudeB);
  }

  async findSimilarFrames(frameId: string, limit: number = 10): Promise<SimilarFrame[]> {
    if (this.qdrantClient) {
      try {
        // Get the reference frame vector
        const refFrame = await this.qdrantClient.retrieve(this.collectionName, {
          ids: [frameId],
          with_vector: true
        });

        if (refFrame.length === 0) {
          throw new Error('Reference frame not found');
        }

        const refVector = refFrame[0].vector as number[];

        // Search for similar vectors
        const searchResult = await this.qdrantClient.search(this.collectionName, {
          vector: refVector,
          limit: limit + 1, // +1 because the reference frame will be included
          with_payload: true,
          score_threshold: 0.1
        });

        // Convert results and filter out the reference frame
        return searchResult
          .filter((result: any) => result.id !== frameId)
          .slice(0, limit)
          .map((result: any) => ({
            frame: {
              id: result.id,
              videoId: result.payload.videoId,
              timestamp: result.payload.timestamp,
              filename: result.payload.filename,
              path: result.payload.path
            },
            score: result.score
          }));
      } catch (error) {
        console.error('Error searching with Qdrant:', error);
        // Fallback to in-memory search
      }
    }

    // In-memory similarity search
    const refFrameData = this.inMemoryVectors.get(frameId);
    if (!refFrameData) {
      throw new Error('Reference frame not found');
    }

    const similarities: SimilarFrame[] = [];
    
    for (const [id, { frame, features }] of this.inMemoryVectors) {
      if (id !== frameId) {
        const score = this.cosineSimilarity(refFrameData.features, features);
        similarities.push({ frame, score });
      }
    }

    // Sort by similarity score (descending) and return top results
    return similarities
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  async processFrame(frame: FrameData): Promise<FrameData> {
    try {
      const features = await this.computeColorHistogram(frame.path);
      await this.storeFrameVector(frame, features);
      
      return {
        ...frame,
        features
      };
    } catch (error) {
      console.error('Error processing frame:', error);
      throw error;
    }
  }
}
