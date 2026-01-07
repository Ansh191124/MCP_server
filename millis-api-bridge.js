import cors from 'cors';
import express from 'express';
import { Agents, connectDB } from './agent-database.js';

const app = express();

// API Base URL for backend
const API_BASE_URL = process.env.API_BASE_URL || 'https://digital-api-tef8.onrender.com';

// ======// Middleware
app.use(cors());
app.use(express.json());

// Connect to database
await connectDB();

// ========================================
// AGENT PROMPT ENDPOINTS
// ========================================

/**
 * Get agent prompt by phone number (Legacy)
 * POST /api/get-agent-prompt
 */
app.post('/api/get-agent-prompt', async (req, res) => {
  try {
    const { phoneNumber } = req.body;
    
    console.log('');
    console.log('========================================');
    console.log('🔔 INCOMING CALL DETECTED!');
    console.log('========================================');
    console.log(`📞 Phone Number: ${phoneNumber}`);
    console.log(`⏰ Time: ${new Date().toLocaleString()}`);
    console.log('========================================');
    
    if (!phoneNumber) {
      return res.status(400).json({
        success: false,
        error: 'Phone number is required'
      });
    }

    // First try to get from prompts API (new system)
    try {
      const promptResponse = await fetch(
        `${API_BASE_URL}/api/prompts/by-phone/${encodeURIComponent(phoneNumber)}`
      );
      if (promptResponse.ok) {
        const promptData = await promptResponse.json();
        if (promptData.success) {
          console.log(`✅ PROMPT FOUND: ${promptData.hospitalName}`);
          return res.json({
            success: true,
            source: 'prompts',
            hospitalName: promptData.hospitalName,
            agentPrompt: promptData.systemPrompt,
            doctors: promptData.doctors,
            features: promptData.features
          });
        }
      }
    } catch (e) {
      console.log('⚠️ Prompt API not available, falling back to agents');
    }

    // Fallback to agents collection
    const agent = await Agents.getByPhoneNumber(phoneNumber);
    
    if (!agent) {
      console.log(`❌ NO AGENT FOUND for ${phoneNumber}`);
      return res.status(404).json({
        success: false,
        error: `No agent found for phone number ${phoneNumber}`
      });
    }

    console.log(`✅ AGENT FOUND: ${agent.agentName}`);
    
    res.json({
      success: true,
      source: 'agents',
      agentId: agent.agentId,
      agentName: agent.agentName,
      phoneNumber: agent.phoneNumber,
      agentPrompt: agent.agentPrompt,
      active: agent.active
    });

  } catch (error) {
    console.error('❌ ERROR:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ========================================
// DOCTOR & AVAILABILITY ENDPOINTS (Proxy)
// ========================================

/**
 * Check doctor availability
 * GET /api/availability
 */
app.get('/api/availability', async (req, res) => {
  try {
    const params = new URLSearchParams(req.query);
    const response = await fetch(`${API_BASE_URL}/api/availability?${params}`);
    const data = await response.json();
    res.json(data);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Check doctor availability - POST version for Millis
 * POST /api/availability
 */
app.post('/api/availability', async (req, res) => {
  try {
    const { assignedPhoneNumber, date, doctorName, doctorId, specialization } = req.body;
    
    console.log('');
    console.log('========================================');
    console.log('🔍 CHECKING AVAILABILITY');
    console.log('========================================');
    console.log('Phone:', assignedPhoneNumber);
    console.log('Date:', date);
    console.log('Doctor:', doctorName || doctorId || 'All');
    console.log('========================================');
    
    const params = new URLSearchParams();
    if (assignedPhoneNumber) params.append('assignedPhoneNumber', assignedPhoneNumber);
    if (date) params.append('date', date);
    if (doctorName) params.append('doctorName', doctorName);
    if (doctorId) params.append('doctorId', doctorId);
    if (specialization) params.append('specialization', specialization);
    
    const response = await fetch(`${API_BASE_URL}/api/availability?${params}`);
    const data = await response.json();
    
    console.log('✅ Found', data.doctors?.length || 0, 'doctors');
    res.json(data);
  } catch (error) {
    console.error('❌ ERROR:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Get doctors by phone
 * GET /api/doctors
 */
app.get('/api/doctors', async (req, res) => {
  try {
    const { assignedPhoneNumber, specialization } = req.query;
    
    console.log('');
    console.log('========================================');
    console.log('👨‍⚕️ FETCHING DOCTORS (GET)');
    console.log('========================================');
    console.log('Phone:', assignedPhoneNumber);
    console.log('Specialization:', specialization || 'All');
    console.log('========================================');
    
    if (!assignedPhoneNumber) {
      return res.status(400).json({
        success: false,
        error: 'assignedPhoneNumber query parameter is required'
      });
    }
    
    const params = new URLSearchParams();
    if (specialization) params.append('specialization', specialization);
    
    const response = await fetch(
      `${API_BASE_URL}/api/doctors/by-phone/${encodeURIComponent(assignedPhoneNumber)}?${params}`
    );
    const data = await response.json();
    
    console.log('✅ Found', data.doctors?.length || 0, 'doctors');
    res.json(data);
  } catch (error) {
    console.error('❌ ERROR:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Get doctors - POST version for Millis
 * POST /api/doctors
 */
app.post('/api/doctors', async (req, res) => {
  try {
    let { assignedPhoneNumber, specialization } = req.body;
    
    console.log('');
    console.log('========================================');
    console.log('👨‍⚕️ FETCHING DOCTORS');
    console.log('========================================');
    console.log('Phone:', assignedPhoneNumber);
    console.log('Specialization:', specialization || 'All');
    console.log('========================================');
    
    if (!assignedPhoneNumber) {
      return res.status(400).json({
        success: false,
        error: 'assignedPhoneNumber is required. Use {{agent_number}} in your Millis config or provide directly.'
      });
    }
    
    const params = new URLSearchParams();
    if (specialization) params.append('specialization', specialization);
    
    const response = await fetch(
      `${API_BASE_URL}/api/doctors/by-phone/${encodeURIComponent(assignedPhoneNumber)}?${params}`
    );
    const data = await response.json();
    
    console.log('✅ Found', data.doctors?.length || 0, 'doctors');
    res.json(data);
  } catch (error) {
    console.error('❌ ERROR:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Book appointment
 * POST /api/book-appointment
 */
app.post('/api/book-appointment', async (req, res) => {
  try {
    console.log('');
    console.log('========================================');
    console.log('📅 BOOKING APPOINTMENT');
    console.log('========================================');
    console.log('Patient:', req.body.patientName);
    console.log('Phone:', req.body.patientPhone);
    console.log('Date:', req.body.date);
    console.log('Time:', req.body.time);
    console.log('========================================');

    const response = await fetch(`${API_BASE_URL}/api/availability/book`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body)
    });
    
    const data = await response.json();
    res.status(response.status).json(data);
  } catch (error) {
    console.error('❌ BOOKING ERROR:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Cancel appointment
 * POST /api/cancel-appointment
 */
app.post('/api/cancel-appointment', async (req, res) => {
  try {
    console.log('');
    console.log('========================================');
    console.log('❌ CANCELLING APPOINTMENT');
    console.log('========================================');

    const response = await fetch(`${API_BASE_URL}/api/availability/cancel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body)
    });
    
    const data = await response.json();
    res.status(response.status).json(data);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ========================================
// LEGACY AGENT MANAGEMENT ENDPOINTS
// ========================================

/**
 * Create or update agent
 */
app.post('/api/create-agent', async (req, res) => {
  try {
    const { agentId, agentName, phoneNumber, agentPrompt, active, metadata } = req.body;
    
    if (!agentId || !agentName || !phoneNumber || !agentPrompt) {
      return res.status(400).json({
        success: false,
        error: 'agentId, agentName, phoneNumber, and agentPrompt are required'
      });
    }

    const result = await Agents.upsert({
      agentId,
      agentName,
      phoneNumber,
      agentPrompt,
      active: active !== undefined ? active : true,
      metadata: metadata || {}
    });

    res.json({
      success: true,
      message: result.upsertedCount > 0 ? 'Created' : 'Updated',
      agentId
    });

  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * List all agents
 */
app.get('/api/agents', async (req, res) => {
  try {
    const agents = await Agents.getAllActive();
    res.json({
      success: true,
      count: agents.length,
      agents: agents.map(a => ({
        agentId: a.agentId,
        agentName: a.agentName,
        phoneNumber: a.phoneNumber
      }))
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Health check
 */
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    service: 'Millis AI Bridge v2.0',
    timestamp: new Date().toISOString(),
    backend: API_BASE_URL
  });
});

/**
 * API Documentation
 */
app.get('/', (req, res) => {
  res.json({
    service: 'Millis AI Webhook Bridge',
    version: '2.0.0',
    endpoints: {
      // Prompt/Agent
      'POST /api/get-agent-prompt': 'Get agent prompt by phone (Main)',
      'POST /api/create-agent': 'Create/update agent',
      'GET /api/agents': 'List all agents',
      
      // Appointments
      'GET /api/availability': 'Check doctor availability',
      'POST /api/availability': 'Check doctor availability (POST)',
      'GET /api/doctors': 'Get doctors for a clinic (assignedPhoneNumber query param)',
      'POST /api/doctors': 'Get doctors for a clinic (POST)',
      'POST /api/book-appointment': 'Book an appointment',
      'POST /api/cancel-appointment': 'Cancel an appointment',
      
      // System
      'GET /api/health': 'Health check'
    }
  });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log('');
  console.log('========================================');
  console.log('✅ Millis AI Bridge v2.0 Running!');
  console.log('========================================');
  console.log(`🌐 Server: http://localhost:${PORT}`);
  console.log(`🔗 Backend: ${API_BASE_URL}`);
  console.log(`📞 Webhook: POST /api/get-agent-prompt`);
  console.log(`📅 Book: POST /api/book-appointment`);
  console.log('========================================');
  console.log('');
});
