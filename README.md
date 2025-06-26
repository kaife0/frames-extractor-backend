# Video Frame Extraction & Similarity Search Backend

A powerful Express.js backend service for extracting frames from videos and performing similarity searches using vector embeddings. This service processes uploaded videos, extracts frames at specified intervals, and enables intelligent frame-based similarity searching.

## 🚀 Features

- **Video Upload & Processing**: Upload videos and extract frames automatically
- **Frame Extraction**: Extract frames at configurable intervals using FFmpeg
- **Image Processing**: Resize and optimize frames using Sharp
- **Vector Similarity Search**: Store and query frame embeddings using Qdrant vector database
- **RESTful API**: Clean REST endpoints for all operations
- **CORS Support**: Configurable CORS for frontend integration
- **Error Handling**: Comprehensive error handling and logging
- **Production Ready**: Optimized for deployment on platforms like Render

## 🛠️ Tech Stack

- **Runtime**: Node.js with TypeScript
- **Framework**: Express.js
- **Video Processing**: FFmpeg (via fluent-ffmpeg)
- **Image Processing**: Sharp
- **Vector Database**: Qdrant
- **File Upload**: Multer
- **Security**: Helmet, CORS
- **Development**: ts-node-dev for hot reloading

## 📋 Prerequisites

- Node.js (v18 or higher)
- FFmpeg installed on your system
- Qdrant vector database (cloud or self-hosted)

## 🔧 Installation

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd backend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Setup**
   Create a `.env` file in the root directory:
   ```env
   # Server Configuration
   PORT=3001
   NODE_ENV=development
   
   # Directory Configuration
   UPLOAD_DIR=uploads
   FRAMES_DIR=frames
   
   # Qdrant Configuration
   QDRANT_URL=https://your-qdrant-instance.com
   QDRANT_API_KEY=your-api-key
   QDRANT_COLLECTION=video_frames
   
   # CORS Configuration
   ALLOWED_ORIGINS=http://localhost:5173,https://your-frontend-domain.com
   ```

4. **Create required directories**
   ```bash
   mkdir uploads frames
   ```

## 🚀 Development

**Start development server with hot reloading:**
```bash
npm run dev
```

**Build for production:**
```bash
npm run build
```

**Start production server:**
```bash
npm start
```

**Clean build directory:**
```bash
npm run clean
```

## 📡 API Endpoints

### Video Upload & Processing

#### Upload Video
```http
POST /api/video/upload
Content-Type: multipart/form-data
```

**Body:**
- `video`: Video file (mp4, avi, mov, etc.)

**Response:**
```json
{
  "message": "Video uploaded and processed successfully",
  "videoId": "cc523955-0ad1-4797-b74c-89df14435190",
  "frameCount": 15,
  "metadata": {
    "duration": 30.5,
    "fps": 25,
    "resolution": "1920x1080"
  }
}
```

#### Get Video Information
```http
GET /api/video/:videoId/info
```

**Response:**
```json
{
  "videoId": "cc523955-0ad1-4797-b74c-89df14435190",
  "metadata": {
    "duration": 30.5,
    "fps": 25,
    "resolution": "1920x1080"
  },
  "frameCount": 15,
  "frames": [
    "frame_0001.png",
    "frame_0002.png"
  ]
}
```

#### Get Video Frames
```http
GET /api/video/:videoId/frames
```

**Response:**
```json
{
  "videoId": "cc523955-0ad1-4797-b74c-89df14435190",
  "frames": [
    {
      "filename": "frame_0001.png",
      "url": "/frames/cc523955-0ad1-4797-b74c-89df14435190/frame_0001.png",
      "timestamp": 0
    }
  ]
}
```

### Similarity Search

#### Search Similar Frames
```http
POST /api/video/search
Content-Type: multipart/form-data
```

**Body:**
- `image`: Image file to search for similar frames

**Response:**
```json
{
  "results": [
    {
      "videoId": "cc523955-0ad1-4797-b74c-89df14435190",
      "frameFilename": "frame_0005.png",
      "similarity": 0.95,
      "url": "/frames/cc523955-0ad1-4797-b74c-89df14435190/frame_0005.png"
    }
  ]
}
```

### Static File Access

#### Access Frame Images
```http
GET /frames/:videoId/:filename
```

#### Access Uploaded Videos
```http
GET /uploads/:filename
```

### Health Check
```http
GET /health
```

## 🏗️ Project Structure

```
backend/
├── src/
│   ├── app.ts                 # Main application setup
│   ├── middleware/
│   │   └── errorHandler.ts    # Global error handling
│   ├── routes/
│   │   └── video.ts          # Video-related API routes
│   └── services/
│       ├── videoService.ts   # Video processing logic
│       └── vectorService.ts  # Vector database operations
├── uploads/                  # Uploaded video files
├── frames/                   # Extracted frame images
├── dist/                     # Compiled JavaScript (production)
├── package.json
├── tsconfig.json
├── requirements.txt          # Python dependencies (if any)
└── README.md
```

## 🔧 Configuration

### Environment Variables

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `PORT` | Server port | 3001 | No |
| `NODE_ENV` | Environment mode | development | No |
| `UPLOAD_DIR` | Upload directory | uploads | No |
| `FRAMES_DIR` | Frames directory | frames | No |
| `QDRANT_URL` | Qdrant database URL | - | Yes |
| `QDRANT_API_KEY` | Qdrant API key | - | Yes |
| `QDRANT_COLLECTION` | Qdrant collection name | video_frames | No |
| `ALLOWED_ORIGINS` | CORS allowed origins | localhost:5173 | No |

### CORS Configuration

The application supports multiple origins for CORS. Configure via `ALLOWED_ORIGINS` environment variable:

```env
ALLOWED_ORIGINS=http://localhost:5173,https://your-app.com,https://your-app.netlify.app
```

## 🚀 Deployment

### Deploy to Render

1. **Connect your repository** to Render

2. **Create a new Web Service** with these settings:
   - **Build Command**: `npm ci && npm run build`
   - **Start Command**: `npm start`
   - **Environment**: Node.js
   - **Node Version**: 18

3. **Set Environment Variables** in Render dashboard:
   ```
   NODE_ENV=production
   NODE_VERSION=18
   QDRANT_URL=your-qdrant-url
   QDRANT_API_KEY=your-api-key
   ALLOWED_ORIGINS=https://your-frontend-domain.com
   ```

4. **Deploy** and monitor the build logs

### Deploy to Other Platforms

- **Heroku**: Similar setup with `Procfile`
- **Railway**: Auto-detects Node.js setup
- **DigitalOcean App Platform**: Configure via spec file
- **AWS/GCP/Azure**: Use Docker or native Node.js deployment

## 🧪 Testing

**Test video upload:**
```bash
curl -X POST http://localhost:3001/api/video/upload \
  -F "video=@test-video.mp4"
```

**Test health endpoint:**
```bash
curl http://localhost:3001/health
```

## 🛡️ Security Features

- **Helmet.js**: Security headers
- **CORS**: Configurable cross-origin access
- **File Upload Limits**: 100MB max file size
- **Input Validation**: File type and size validation
- **Error Handling**: Secure error responses

## 📝 Logging

The application includes comprehensive logging:
- HTTP request logging via Morgan
- File access logging
- Error logging
- CORS debugging

## 🐛 Troubleshooting

### Common Issues

**1. CORS Errors**
- Check `ALLOWED_ORIGINS` environment variable
- Verify frontend domain is included in allowed origins

**2. FFmpeg Not Found**
- Install FFmpeg: `npm install ffmpeg-static`
- Verify FFmpeg is in system PATH

**3. Upload Failures**
- Check file size limits (100MB default)
- Verify upload directory permissions
- Check available disk space

**4. Vector Search Issues**
- Verify Qdrant connection
- Check API key and collection name
- Ensure collection is created

### Debug Mode

Enable debug logging:
```env
NODE_ENV=development
DEBUG=*
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details

## 🙋‍♂️ Support

For issues and questions:
- Create an issue in the repository
- Check the troubleshooting section
- Review the API documentation

---

**Made with ❤️ for efficient video frame processing and similarity search**
