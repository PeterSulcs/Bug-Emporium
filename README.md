# Bug Emporium 🐛

A modern web application for issue triage in GitLab repositories. The Bug Emporium treats issues like items in a marketplace, helping teams visualize and manage their bug backlog in a fun and intuitive way.

## Features

- **Issue Categorization**: Automatically categorizes issues into:
  - 🛒 **For Sale**: Issues with no assignee (available for pickup)
  - 💰 **Sold**: Issues with an assignee (in progress)
  - ✅ **Delivered**: Closed issues (completed)

- **Priority Support**: Issues with a configurable priority label appear at the top of lists with special highlighting
- **GitLab Integration**: Works with both GitLab.com and on-premises GitLab instances
- **Modern UI**: Beautiful, responsive design with real-time updates
- **No Authentication Required**: Simple, open access for team collaboration

## Quick Start

### Prerequisites

- Node.js 16+ and npm
- GitLab instance (cloud or on-premises)
- GitLab read-only access token
- GitLab group ID

### Installation

1. **Clone and install dependencies:**
   ```bash
   git clone <repository-url>
   cd bug-emporium
   npm install
   cd backend && npm install
   cd ../frontend && npm install
   ```

2. **Configure the backend:**
   ```bash
   cd backend
   cp config.example.env .env
   ```
   
   Edit `.env` with your GitLab configuration:
   ```env
   GITLAB_ENDPOINT=https://gitlab.com
   GITLAB_TOKEN=your_gitlab_read_only_token_here
   GITLAB_GROUP_ID=your_gitlab_group_id_here
   EMPORIUM_LABEL=emporium
   PRIORITY_LABEL=priority
   PORT=3001
   NODE_ENV=development
   ```

3. **Start the application:**
   ```bash
   # From the root directory
   npm run dev
   ```
   
   This will start both the backend (port 3001) and frontend (port 3000) servers for development.

4. **Open your browser:**
   Navigate to `http://localhost:3000` (development) or `http://localhost:3001` (production)

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `GITLAB_ENDPOINT` | Your GitLab instance URL | `https://gitlab.com` |
| `GITLAB_TOKEN` | GitLab read-only access token | Required |
| `GITLAB_GROUP_ID` | GitLab group ID to monitor | Required |
| `EMPORIUM_LABEL` | Label to filter issues | `emporium` |
| `PRIORITY_LABEL` | Label for priority issues | `priority` |
| `PORT` | Backend server port | `3001` |

### GitLab Setup

1. **Create a GitLab Access Token:**
   - Go to GitLab → User Settings → Access Tokens
   - Create a token with `read_api` scope
   - Copy the token to your `.env` file

2. **Find your Group ID:**
   - Navigate to your GitLab group
   - The group ID is in the URL: `https://gitlab.com/groups/your-group/-/issues` → ID is the number

3. **Label your issues:**
   - Add the `emporium` label to issues you want to appear in the Bug Emporium
   - Optionally add a `priority` label to issues that should appear at the top

## How It Works

### Issue Categorization

The Bug Emporium automatically categorizes issues based on their state and assignee:

- **For Sale** 🛒: Open issues with no assignee
- **Sold** 💰: Open issues with an assignee  
- **Delivered** ✅: Closed issues

### Priority System

Issues with the configured priority label (default: `priority`) will:
- Appear at the top of their respective category
- Display with special highlighting and a fire emoji 🔥
- Stand out visually from regular issues

### GitLab Integration

The backend fetches issues from all projects within the specified GitLab group, including subgroups. It uses the GitLab API to:
- Retrieve all projects in the group
- Fetch issues with the emporium label
- Include both open and closed issues
- Provide real-time data when refreshed

## Development

### Project Structure

```
bug-emporium/
├── backend/                 # Node.js/Express API server
│   ├── server.js           # Main server file
│   ├── package.json        # Backend dependencies
│   └── config.example.env  # Configuration template
├── frontend/               # React/Vite frontend
│   ├── src/
│   │   ├── components/     # React components
│   │   ├── App.jsx         # Main app component
│   │   └── main.jsx        # App entry point
│   ├── package.json        # Frontend dependencies
│   └── vite.config.js      # Vite configuration
├── package.json            # Root package.json with scripts
└── README.md              # This file
```

### Available Scripts

- `npm run dev` - Start both backend and frontend in development mode
- `npm run server` - Start only the backend server
- `npm run client` - Start only the frontend development server
- `npm run build` - Build the frontend for production
- `npm start` - Start the backend in production mode

### API Endpoints

- `GET /api/health` - Health check
- `GET /api/config` - Get server configuration
- `GET /api/issues` - Get categorized issues from GitLab

## Deployment

### Production Setup

**Option 1: Docker (Recommended)**
```bash
# Build and run with Docker
docker build -t bug-emporium .
docker run -p 3001:3001 \
  -e GITLAB_ENDPOINT=https://your-gitlab.com \
  -e GITLAB_TOKEN=your-token \
  -e GITLAB_GROUP_ID=your-group-id \
  bug-emporium
```

**Option 2: Manual Setup**
1. **Build the frontend:**
   ```bash
   cd frontend
   npm run build
   ```

2. **Copy frontend build to backend:**
   ```bash
   cp -r frontend/dist backend/public
   ```

3. **Configure production environment:**
   ```bash
   cd backend
   cp config.example.env .env
   # Edit .env with production values
   ```

4. **Start the production server:**
   ```bash
   npm start
   ```

The production server will serve both the API and the React frontend on port 3001.

### Docker Deployment (Optional)

You can containerize the application using Docker. Create a `Dockerfile` in the root directory:

```dockerfile
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY backend/package*.json ./backend/
COPY frontend/package*.json ./frontend/

# Install dependencies
RUN npm install
RUN cd backend && npm install
RUN cd frontend && npm install

# Build frontend
RUN cd frontend && npm run build

# Copy source code
COPY . .

EXPOSE 3001

CMD ["npm", "start"]
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

MIT License - see LICENSE file for details.

## Support

For issues and questions:
1. Check the GitLab configuration
2. Verify your access token has the correct permissions
3. Ensure the group ID is correct
4. Check that issues have the required labels

---

**Happy Bug Hunting!** 🐛✨
