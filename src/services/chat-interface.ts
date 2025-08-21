import express, { Express, Request, Response } from 'express';
import { Server as SocketIOServer } from 'socket.io';
import { createServer } from 'http';
import cors from 'cors';
import winston from 'winston';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';

interface ChatMessage {
  id: string;
  sessionId: string;
  userId?: string;
  userInput: string;
  agentResponse?: string;
  agentType?: string;
  timestamp: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  metadata?: Record<string, any>;
}

interface ChatSession {
  sessionId: string;
  userId?: string;
  startTime: string;
  lastActivity: string;
  messages: ChatMessage[];
  context: Record<string, any>;
}

interface VoiceMessage {
  id: string;
  sessionId: string;
  audioData?: ArrayBuffer;
  transcription?: string;
  response?: string;
  timestamp: string;
  status: 'processing' | 'completed' | 'failed';
}

class ChatInterfaceService {
  private app: Express;
  private server: any;
  private io: SocketIOServer;
  private logger: winston.Logger;
  private port: number;
  
  private activeSessions: Map<string, ChatSession> = new Map();
  private voiceMessages: Map<string, VoiceMessage> = new Map();
  
  // Agent endpoints
  private agentEndpoints = {
    architect: 'http://localhost:5001',
    developer: 'http://localhost:5002',
    devops: 'http://localhost:5003',
    qa: 'http://localhost:5004',
    manager: 'http://localhost:5005'
  };

  // Natural language processing patterns for agent routing
  private agentPatterns = {
    architect: [
      /architect|architecture|design|system design|technical spec|integration/i,
      /how should (i|we) design|what architecture|system structure/i
    ],
    developer: [
      /code|implement|develop|bug|feature|function|method|programming/i,
      /write code|fix bug|implement feature|create function/i
    ],
    devops: [
      /deploy|deployment|docker|kubernetes|ci\/cd|infrastructure|pipeline/i,
      /how to deploy|deployment process|container|infrastructure/i
    ],
    qa: [
      /test|testing|quality|qa|performance|security|bug report/i,
      /run tests|test coverage|quality check|performance test/i
    ],
    manager: [
      /plan|planning|strategy|coordinate|manage|timeline|priority/i,
      /project plan|coordination|management|strategy|roadmap/i
    ]
  };

  constructor() {
    this.port = parseInt(process.env.CHAT_SERVICE_PORT || '7000');
    this.app = express();
    this.server = createServer(this.app);
    
    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.printf(({ timestamp, level, message, ...meta }) => {
          return `${timestamp} [ChatInterface] ${level}: ${message} ${Object.keys(meta).length ? JSON.stringify(meta) : ''}`;
        })
      ),
      transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: 'logs/chat-interface.log' })
      ]
    });

    this.setupExpress();
    this.setupSocketIO();
    
    this.logger.info('Chat Interface Service initialized');
  }

  private setupExpress(): void {
    this.app.use(cors({
      origin: ['http://localhost:3000', 'http://localhost:5173', 'http://localhost:8080'],
      credentials: true
    }));
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.static('public'));

    // Health check
    this.app.get('/health', (_req: Request, res: Response) => {
      res.json({ 
        status: 'healthy', 
        service: 'Chat Interface',
        activeSessions: this.activeSessions.size 
      });
    });

    // REST API endpoints
    this.app.post('/api/chat/session', this.createSession.bind(this));
    this.app.get('/api/chat/session/:sessionId', this.getSession.bind(this));
    this.app.post('/api/chat/message', this.sendMessage.bind(this));
    this.app.post('/api/voice/transcribe', this.transcribeVoice.bind(this));
    this.app.get('/api/agents/status', this.getAgentsStatus.bind(this));
    
    // Serve chat UI (simple HTML interface)
    this.app.get('/', this.serveChatUI.bind(this));
  }

  private setupSocketIO(): void {
    this.io = new SocketIOServer(this.server, {
      cors: {
        origin: ['http://localhost:3000', 'http://localhost:5173', 'http://localhost:8080'],
        methods: ['GET', 'POST']
      }
    });

    this.io.on('connection', (socket) => {
      this.logger.info(`Client connected: ${socket.id}`);
      
      socket.on('join_session', (data) => {
        const { sessionId, userId } = data;
        socket.join(sessionId);
        this.logger.info(`Client ${socket.id} joined session ${sessionId}`);
        
        // Send session history
        const session = this.activeSessions.get(sessionId);
        if (session) {
          socket.emit('session_history', session.messages);
        }
      });

      socket.on('chat_message', async (data) => {
        await this.handleSocketMessage(socket, data);
      });

      socket.on('voice_message', async (data) => {
        await this.handleVoiceMessage(socket, data);
      });

      socket.on('disconnect', () => {
        this.logger.info(`Client disconnected: ${socket.id}`);
      });
    });
  }

  private async createSession(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.body;
      const sessionId = uuidv4();
      
      const session: ChatSession = {
        sessionId,
        userId,
        startTime: new Date().toISOString(),
        lastActivity: new Date().toISOString(),
        messages: [],
        context: {}
      };
      
      this.activeSessions.set(sessionId, session);
      
      res.json({ 
        sessionId, 
        status: 'created',
        endpoints: {
          websocket: `ws://localhost:${this.port}`,
          rest: `http://localhost:${this.port}/api`
        }
      });
      
      this.logger.info(`Created chat session: ${sessionId}`);
    } catch (error) {
      this.logger.error('Error creating session:', error);
      res.status(500).json({ error: 'Failed to create session' });
    }
  }

  private async getSession(req: Request, res: Response): Promise<void> {
    try {
      const { sessionId } = req.params;
      const session = this.activeSessions.get(sessionId);
      
      if (!session) {
        res.status(404).json({ error: 'Session not found' });
        return;
      }
      
      res.json(session);
    } catch (error) {
      this.logger.error('Error getting session:', error);
      res.status(500).json({ error: 'Failed to get session' });
    }
  }

  private async sendMessage(req: Request, res: Response): Promise<void> {
    try {
      const { sessionId, userInput, agentType } = req.body;
      
      const message = await this.processMessage(sessionId, userInput, agentType);
      res.json(message);
    } catch (error) {
      this.logger.error('Error sending message:', error);
      res.status(500).json({ error: 'Failed to send message' });
    }
  }

  private async transcribeVoice(req: Request, res: Response): Promise<void> {
    try {
      const { audioData, sessionId } = req.body;
      
      // Mock transcription service (in production, use services like AWS Transcribe, Google Speech-to-Text, etc.)
      const transcription = await this.mockTranscribe(audioData);
      
      const voiceMessage: VoiceMessage = {
        id: uuidv4(),
        sessionId,
        audioData,
        transcription,
        timestamp: new Date().toISOString(),
        status: 'completed'
      };
      
      this.voiceMessages.set(voiceMessage.id, voiceMessage);
      
      // Process the transcribed message
      if (transcription) {
        const chatMessage = await this.processMessage(sessionId, transcription);
        voiceMessage.response = chatMessage.agentResponse;
      }
      
      res.json(voiceMessage);
    } catch (error) {
      this.logger.error('Error transcribing voice:', error);
      res.status(500).json({ error: 'Failed to transcribe voice' });
    }
  }

  private async getAgentsStatus(req: Request, res: Response): Promise<void> {
    try {
      const agentStatuses = {};
      
      for (const [agentType, endpoint] of Object.entries(this.agentEndpoints)) {
        try {
          const response = await axios.get(`${endpoint}/health`, { timeout: 5000 });
          agentStatuses[agentType] = {
            status: 'online',
            health: response.data,
            endpoint
          };
        } catch (error) {
          agentStatuses[agentType] = {
            status: 'offline',
            error: 'Health check failed',
            endpoint
          };
        }
      }
      
      res.json(agentStatuses);
    } catch (error) {
      this.logger.error('Error getting agent status:', error);
      res.status(500).json({ error: 'Failed to get agent status' });
    }
  }

  private async handleSocketMessage(socket: any, data: any): Promise<void> {
    try {
      const { sessionId, userInput, agentType } = data;
      
      // Emit processing status
      socket.emit('message_status', { 
        status: 'processing',
        userInput 
      });
      
      // Process message
      const message = await this.processMessage(sessionId, userInput, agentType);
      
      // Emit response to all clients in the session
      this.io.to(sessionId).emit('agent_response', message);
      
    } catch (error) {
      this.logger.error('Error handling socket message:', error);
      socket.emit('message_error', { error: 'Failed to process message' });
    }
  }

  private async handleVoiceMessage(socket: any, data: any): Promise<void> {
    try {
      const { sessionId, audioData } = data;
      
      socket.emit('voice_status', { status: 'transcribing' });
      
      // Transcribe audio
      const transcription = await this.mockTranscribe(audioData);
      
      if (transcription) {
        socket.emit('voice_transcribed', { transcription });
        
        // Process transcribed message
        const message = await this.processMessage(sessionId, transcription);
        socket.emit('agent_response', message);
      } else {
        socket.emit('voice_error', { error: 'Failed to transcribe audio' });
      }
      
    } catch (error) {
      this.logger.error('Error handling voice message:', error);
      socket.emit('voice_error', { error: 'Voice processing failed' });
    }
  }

  private async processMessage(
    sessionId: string,
    userInput: string,
    explicitAgentType?: string
  ): Promise<ChatMessage> {
    const messageId = uuidv4();
    const timestamp = new Date().toISOString();
    
    // Get or create session
    let session = this.activeSessions.get(sessionId);
    if (!session) {
      session = {
        sessionId,
        startTime: timestamp,
        lastActivity: timestamp,
        messages: [],
        context: {}
      };
      this.activeSessions.set(sessionId, session);
    }
    
    // Create message
    const message: ChatMessage = {
      id: messageId,
      sessionId,
      userInput,
      timestamp,
      status: 'processing'
    };
    
    // Determine which agent to use
    const agentType = explicitAgentType || this.determineAgentFromInput(userInput);
    message.agentType = agentType;
    
    // Add to session
    session.messages.push(message);
    session.lastActivity = timestamp;
    
    try {
      // Send to appropriate agent
      const agentResponse = await this.sendToAgent(agentType, {
        taskId: messageId,
        task: userInput,
        priority: 'medium',
        context: {
          sessionId,
          chatMode: true,
          conversationHistory: session.messages.slice(-5) // Last 5 messages for context
        }
      });
      
      message.agentResponse = agentResponse.result?.message || 
                             agentResponse.result?.response ||
                             'Task completed successfully';
      message.status = 'completed';
      
    } catch (error) {
      this.logger.error(`Error processing message with ${agentType} agent:`, error);
      message.agentResponse = `Sorry, I encountered an error while processing your request. The ${agentType} agent may be unavailable.`;
      message.status = 'failed';
    }
    
    return message;
  }

  private determineAgentFromInput(input: string): string {
    // Check explicit agent mentions first
    const lowerInput = input.toLowerCase();
    
    if (lowerInput.includes('@architect') || lowerInput.includes('architect agent')) return 'architect';
    if (lowerInput.includes('@developer') || lowerInput.includes('developer agent')) return 'developer';
    if (lowerInput.includes('@devops') || lowerInput.includes('devops agent')) return 'devops';
    if (lowerInput.includes('@qa') || lowerInput.includes('qa agent')) return 'qa';
    if (lowerInput.includes('@manager') || lowerInput.includes('manager agent')) return 'manager';
    
    // Use pattern matching
    for (const [agentType, patterns] of Object.entries(this.agentPatterns)) {
      if (patterns.some(pattern => pattern.test(input))) {
        return agentType;
      }
    }
    
    // Default to developer for general requests
    return 'developer';
  }

  private async sendToAgent(agentType: string, payload: any): Promise<any> {
    const endpoint = this.agentEndpoints[agentType as keyof typeof this.agentEndpoints];
    if (!endpoint) {
      throw new Error(`Unknown agent type: ${agentType}`);
    }
    
    const agentUrl = `${endpoint}/agent/ai-${agentType}-agent-1/task`;
    
    const response = await axios.post(agentUrl, payload, {
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'na-agents-chat-interface/1.0'
      }
    });
    
    return response.data;
  }

  private async mockTranscribe(audioData: any): Promise<string> {
    // Mock transcription - in production, integrate with:
    // - AWS Transcribe
    // - Google Speech-to-Text
    // - Azure Speech Services
    // - OpenAI Whisper
    
    // Simulate processing delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Return mock transcription
    return "Hello, can you help me deploy my application to AWS?";
  }

  private serveChatUI(_req: Request, res: Response): void {
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>NA-Agents Chat Interface</title>
    <script src="/socket.io/socket.io.js"></script>
    <style>
        body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
        .chat-container { border: 1px solid #ddd; height: 400px; overflow-y: auto; padding: 10px; margin: 10px 0; }
        .message { margin: 10px 0; padding: 10px; border-radius: 5px; }
        .user-message { background: #e3f2fd; margin-left: 50px; }
        .agent-message { background: #f1f8e9; margin-right: 50px; }
        .agent-type { font-weight: bold; color: #1976d2; }
        .input-container { display: flex; gap: 10px; margin: 10px 0; }
        input[type="text"] { flex: 1; padding: 10px; border: 1px solid #ddd; border-radius: 5px; }
        button { padding: 10px 20px; background: #1976d2; color: white; border: none; border-radius: 5px; cursor: pointer; }
        button:hover { background: #1565c0; }
        .status { padding: 5px; margin: 5px 0; background: #fff3e0; border-radius: 3px; font-size: 0.9em; }
        .agent-selector { margin: 10px 0; }
        select { padding: 8px; border: 1px solid #ddd; border-radius: 3px; }
    </style>
</head>
<body>
    <h1>🤖 NA-Agents Chat Interface</h1>
    
    <div class="agent-selector">
        <label>Select Agent: </label>
        <select id="agentSelect">
            <option value="">Auto-detect</option>
            <option value="architect">Architect Agent</option>
            <option value="developer">Developer Agent</option>
            <option value="devops">DevOps Agent</option>
            <option value="qa">QA Agent</option>
            <option value="manager">Manager Agent</option>
        </select>
    </div>
    
    <div id="chatContainer" class="chat-container">
        <div class="message agent-message">
            <div class="agent-type">System</div>
            <div>Welcome! I can connect you with our specialized AI agents. Just type your message and I'll route it to the right agent.</div>
        </div>
    </div>
    
    <div id="status" class="status" style="display: none;"></div>
    
    <div class="input-container">
        <input type="text" id="messageInput" placeholder="Ask me anything about development, architecture, deployment, testing, or project management...">
        <button onclick="sendMessage()">Send</button>
        <button onclick="startVoiceInput()">🎤 Voice</button>
    </div>
    
    <div style="margin-top: 20px; font-size: 0.9em; color: #666;">
        <p><strong>Examples:</strong></p>
        <ul>
            <li>"How should I design a microservices architecture?" - Routes to Architect Agent</li>
            <li>"Fix this bug in my React component" - Routes to Developer Agent</li>
            <li>"Deploy my app to AWS using containers" - Routes to DevOps Agent</li>
            <li>"Run tests on my application" - Routes to QA Agent</li>
            <li>"What's the status of our current projects?" - Routes to Manager Agent</li>
        </ul>
    </div>

    <script>
        const socket = io();
        let sessionId = null;
        
        // Initialize session
        async function initSession() {
            try {
                const response = await fetch('/api/chat/session', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userId: 'web-user-' + Date.now() })
                });
                const data = await response.json();
                sessionId = data.sessionId;
                socket.emit('join_session', { sessionId });
                console.log('Session created:', sessionId);
            } catch (error) {
                console.error('Failed to create session:', error);
                showStatus('Failed to connect to chat service', 'error');
            }
        }
        
        // Socket event handlers
        socket.on('agent_response', (message) => {
            addMessage(message.agentResponse, message.agentType || 'Agent', 'agent');
            hideStatus();
        });
        
        socket.on('message_status', (data) => {
            showStatus(\`Processing with \${data.agentType || 'appropriate'} agent...\`, 'processing');
        });
        
        socket.on('message_error', (data) => {
            showStatus('Error: ' + data.error, 'error');
        });
        
        // Send message
        function sendMessage() {
            const input = document.getElementById('messageInput');
            const agentSelect = document.getElementById('agentSelect');
            const message = input.value.trim();
            
            if (!message || !sessionId) return;
            
            addMessage(message, 'You', 'user');
            showStatus('Processing...', 'processing');
            
            socket.emit('chat_message', {
                sessionId: sessionId,
                userInput: message,
                agentType: agentSelect.value || undefined
            });
            
            input.value = '';
        }
        
        // Add message to chat
        function addMessage(content, sender, type) {
            const chatContainer = document.getElementById('chatContainer');
            const messageDiv = document.createElement('div');
            messageDiv.className = \`message \${type}-message\`;
            
            if (type === 'agent') {
                messageDiv.innerHTML = \`
                    <div class="agent-type">\${sender} Agent</div>
                    <div>\${content}</div>
                \`;
            } else {
                messageDiv.innerHTML = \`
                    <div class="agent-type">\${sender}</div>
                    <div>\${content}</div>
                \`;
            }
            
            chatContainer.appendChild(messageDiv);
            chatContainer.scrollTop = chatContainer.scrollHeight;
        }
        
        // Show status
        function showStatus(message, type) {
            const statusDiv = document.getElementById('status');
            statusDiv.textContent = message;
            statusDiv.style.display = 'block';
            statusDiv.className = 'status ' + type;
        }
        
        // Hide status
        function hideStatus() {
            document.getElementById('status').style.display = 'none';
        }
        
        // Voice input (mock implementation)
        function startVoiceInput() {
            showStatus('Voice input not yet implemented - this is a placeholder', 'info');
            setTimeout(hideStatus, 3000);
        }
        
        // Handle Enter key
        document.getElementById('messageInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                sendMessage();
            }
        });
        
        // Initialize
        initSession();
    </script>
</body>
</html>`;
    
    res.send(html);
  }

  public async start(): Promise<void> {
    return new Promise((resolve) => {
      this.server.listen(this.port, () => {
        this.logger.info(`Chat Interface Service listening on port ${this.port}`);
        this.logger.info(`Chat UI available at: http://localhost:${this.port}`);
        resolve();
      });
    });
  }

  public async stop(): Promise<void> {
    return new Promise((resolve) => {
      this.server.close(() => {
        this.logger.info('Chat Interface Service stopped');
        resolve();
      });
    });
  }
}

// Singleton instance
export const chatInterface = new ChatInterfaceService();

// Export class for testing
export { ChatInterfaceService };