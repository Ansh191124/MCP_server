# Millis AI Voice Agent MCP Server

A Model Context Protocol (MCP) server for managing Millis AI voice agent prompts with **phone number mapping**. Each agent is identified by a unique phone number, allowing Millis AI to automatically select the correct agent prompt based on incoming calls.

## 🎯 How It Works

When a call comes into Millis AI:
1. Millis gets the phone number (e.g., `+12025551234`)
2. Calls MCP tool `get_agent_by_phone` with that phone number
3. Receives the agent configuration and prompt
4. Uses that prompt for the voice agent conversation

## 📋 Data Structure

Each agent configuration:
```json
{
  "agentId": "AGENT001",
  "agentName": "Sales Assistant Bot",
  "phoneNumber": "+12025551234",
  "agentPrompt": {
    "role": "sales_assistant",
    "personality": "professional and friendly",
    "instructions": "You are a sales assistant...",
    "tone": "enthusiastic",
    "objectives": [
      "Understand customer needs",
      "Recommend products"
    ]
  },
  "active": true,
  "metadata": {
    "department": "Sales",
    "purpose": "Product sales"
  },
  "createdAt": "2025-12-22T10:00:00Z",
  "updatedAt": "2025-12-22T10:00:00Z"
}
```

## 🚀 Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment
Create `.env` file:
```env
MONGODB_URI=mongodb://localhost:27017/millis_agents
DB_NAME=millis_agents
```

### 3. Seed Sample Data
```bash
node agent-seed-data.js
```

This creates 4 sample agents:
- `+12025551234` → Sales Assistant Bot
- `+12025555678` → Customer Support Bot
- `+12025559012` → Appointment Scheduler
- `+12025553456` → Restaurant Reservation Bot

### 4. Configure Claude Desktop

Edit `claude_desktop_config.json`:
```json
{
  "mcpServers": {
    "millis-agents": {
      "command": "node",
      "args": ["c:/Users/DEll/Desktop/mcp/MCP-SERVER/agent-server.js"]
    }
  }
}
```

### 5. Restart Claude Desktop

The MCP server will now be available!

## 🛠️ Available Tools

### 1. `create_agent`
Create or update an agent configuration
```javascript
{
  "agentId": "AGENT005",
  "agentName": "Tech Support Bot",
  "phoneNumber": "+12025557890",
  "agentPrompt": "{...}", // Raw JSON string or object
  "active": true,
  "metadata": {
    "department": "IT Support"
  }
}
```

### 2. `get_agent_by_phone` ⭐ **PRIMARY TOOL FOR MILLIS**
Get agent by phone number (most important for Millis AI)
```javascript
{
  "phoneNumber": "+12025551234"
}
```

Returns:
```json
{
  "success": true,
  "agent": {
    "agentId": "AGENT001",
    "phoneNumber": "+12025551234",
    "agentPrompt": "...",
    ...
  },
  "prompt": "..." // Quick access to prompt
}
```

### 3. `get_agent_by_id`
Get agent by agent ID
```javascript
{
  "agentId": "AGENT001"
}
```

### 4. `list_agents`
List all agents with pagination
```javascript
{
  "skip": 0,
  "limit": 50,
  "activeOnly": true
}
```

### 5. `delete_agent`
Delete an agent
```javascript
{
  "agentId": "AGENT001"
}
```

### 6. `toggle_agent_status`
Activate/deactivate an agent
```javascript
{
  "agentId": "AGENT001",
  "active": false
}
```

## 🔧 Integration with Millis AI

### Flow Diagram:
```
Incoming Call (+12025551234)
         ↓
    Millis AI Tool
         ↓
MCP: get_agent_by_phone("+12025551234")
         ↓
   Returns Agent Prompt
         ↓
  Voice Agent Uses Prompt
```

### Example Integration Code:
```javascript
// When Millis receives a call
const phoneNumber = incomingCall.phoneNumber; // e.g., "+12025551234"

// Call MCP tool
const result = await mcp.callTool('get_agent_by_phone', {
  phoneNumber: phoneNumber
});

if (result.success) {
  const agentPrompt = result.prompt;
  // Use this prompt for the voice agent
  voiceAgent.initialize(agentPrompt);
}
```

## 📱 Phone Number Management

### Best Practices:
1. **Format**: Always use E.164 format (`+[country code][number]`)
   - ✅ `+12025551234`
   - ❌ `202-555-1234`
   - ❌ `(202) 555-1234`

2. **Unique**: Each phone number maps to exactly ONE agent

3. **Active Status**: Use `active: false` to temporarily disable an agent without deleting it

## 🧪 Testing

```bash
# Test the MCP server
node agent-server.js

# In Claude Desktop, try:
"Get the agent for phone number +12025551234"
"Create a new agent for phone number +15105551234"
"List all active agents"
```

## 📊 Database Schema

**Collection**: `agents`

**Indexes**:
- `agentId`: Unique index
- `phoneNumber`: Unique index  
- `active`: Standard index

## 🔍 Monitoring

Check MongoDB for all agents:
```javascript
db.agents.find().pretty()

// Find by phone
db.agents.findOne({ phoneNumber: "+12025551234" })

// List all phone mappings
db.agents.find({}, { phoneNumber: 1, agentName: 1, _id: 0 })
```

## 💡 Use Cases

1. **Multi-Department Call Routing**: Different phone numbers for Sales, Support, Scheduling
2. **A/B Testing**: Test different prompts by routing calls to different numbers
3. **Regional Agents**: Different prompts for different geographic regions
4. **Language-Specific**: Spanish line, English line, etc.
5. **Time-Based**: Switch active agents based on business hours

## 🚨 Troubleshooting

**Agent not found**:
- Verify phone number format (must be E.164)
- Check if agent is active (`active: true`)
- Confirm MongoDB connection

**Duplicate phone number**:
- Each phone number must be unique
- Update existing agent instead of creating new one

## 📝 License

MIT
