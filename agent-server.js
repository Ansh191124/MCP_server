#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { Agents, closeDB, connectDB } from './agent-database.js';

// API Base URL for backend
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:4000';

/**
 * MCP Server for Millis AI Voice Agent - Appointment System
 */
class MillisAgentServer {
  constructor() {
    this.server = new Server(
      {
        name: 'millis-agent-mcp-server',
        version: '2.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupToolHandlers();
    
    // Handle shutdown gracefully
    process.on('SIGINT', async () => {
      await closeDB();
      process.exit(0);
    });
  }

  setupToolHandlers() {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        // ========================================
        // AGENT MANAGEMENT TOOLS
        // ========================================
        {
          name: 'create_agent',
          description: 'Create or update a Millis AI voice agent configuration with phone number mapping',
          inputSchema: {
            type: 'object',
            properties: {
              agentId: {
                type: 'string',
                description: 'Unique identifier for the agent',
              },
              agentName: {
                type: 'string',
                description: 'Human-readable name for the agent',
              },
              phoneNumber: {
                type: 'string',
                description: 'Phone number for this agent (e.g., "+1234567890")',
              },
              agentPrompt: {
                type: 'string',
                description: 'The voice agent prompt',
              },
              active: {
                type: 'boolean',
                description: 'Whether this agent is active',
                default: true,
              },
              metadata: {
                type: 'object',
                description: 'Additional metadata',
              },
            },
            required: ['agentId', 'agentName', 'phoneNumber', 'agentPrompt'],
          },
        },
        {
          name: 'get_agent_by_phone',
          description: 'Get agent prompt by phone number. PRIMARY method for Millis AI to identify which agent/prompt to use.',
          inputSchema: {
            type: 'object',
            properties: {
              phoneNumber: {
                type: 'string',
                description: 'Phone number to lookup',
              },
            },
            required: ['phoneNumber'],
          },
        },
        {
          name: 'list_agents',
          description: 'List all agents with pagination',
          inputSchema: {
            type: 'object',
            properties: {
              skip: { type: 'number', default: 0 },
              limit: { type: 'number', default: 50 },
              activeOnly: { type: 'boolean', default: false },
            },
          },
        },
        {
          name: 'delete_agent',
          description: 'Delete an agent configuration',
          inputSchema: {
            type: 'object',
            properties: {
              agentId: { type: 'string', description: 'Agent ID to delete' },
            },
            required: ['agentId'],
          },
        },
        {
          name: 'toggle_agent_status',
          description: 'Activate or deactivate an agent',
          inputSchema: {
            type: 'object',
            properties: {
              agentId: { type: 'string' },
              active: { type: 'boolean' },
            },
            required: ['agentId', 'active'],
          },
        },

        // ========================================
        // APPOINTMENT SYSTEM TOOLS
        // ========================================
        {
          name: 'get_prompt_by_phone',
          description: 'Get hospital/clinic prompt and configuration by assigned phone number. Used when a call comes in to load the system prompt.',
          inputSchema: {
            type: 'object',
            properties: {
              assignedPhoneNumber: {
                type: 'string',
                description: 'The hospital/clinic phone number',
              },
            },
            required: ['assignedPhoneNumber'],
          },
        },
        {
          name: 'check_doctor_availability',
          description: 'Check available appointment slots for doctors. Can filter by specialization, doctor name, or doctor ID.',
          inputSchema: {
            type: 'object',
            properties: {
              assignedPhoneNumber: {
                type: 'string',
                description: 'The hospital phone number',
              },
              date: {
                type: 'string',
                description: 'Date to check (YYYY-MM-DD format). Defaults to today.',
              },
              specialization: {
                type: 'string',
                description: 'Filter by doctor specialization (e.g., "Cardiologist", "Orthopedic")',
              },
              doctorName: {
                type: 'string',
                description: 'Filter by doctor name (e.g., "Dr. Smith", "Sharma")',
              },
              doctorId: {
                type: 'string',
                description: 'Specific doctor ID to check',
              },
            },
            required: ['assignedPhoneNumber'],
          },
        },
        {
          name: 'get_doctors',
          description: 'Get list of all doctors for a clinic/hospital',
          inputSchema: {
            type: 'object',
            properties: {
              assignedPhoneNumber: {
                type: 'string',
                description: 'The hospital phone number',
              },
              specialization: {
                type: 'string',
                description: 'Filter by specialization',
              },
            },
            required: ['assignedPhoneNumber'],
          },
        },
        {
          name: 'book_appointment',
          description: 'Book an appointment for a patient with a doctor. Can use either doctor name or doctor ID.',
          inputSchema: {
            type: 'object',
            properties: {
              assignedPhoneNumber: {
                type: 'string',
                description: 'The hospital phone number',
              },
              doctorId: {
                type: 'string',
                description: 'The doctor ID to book with (optional if doctorName provided)',
              },
              doctorName: {
                type: 'string',
                description: 'The doctor name to book with (e.g., "Dr. Smith", "Sharma")',
              },
              patientName: {
                type: 'string',
                description: 'Patient full name',
              },
              patientPhone: {
                type: 'string',
                description: 'Patient phone number',
              },
              date: {
                type: 'string',
                description: 'Appointment date (YYYY-MM-DD)',
              },
              time: {
                type: 'string',
                description: 'Appointment time (e.g., "2:00 PM", "14:00")',
              },
              purpose: {
                type: 'string',
                description: 'Reason for visit',
              },
            },
            required: ['assignedPhoneNumber', 'patientName', 'patientPhone', 'date', 'time'],
          },
        },
        {
          name: 'cancel_appointment',
          description: 'Cancel an existing appointment',
          inputSchema: {
            type: 'object',
            properties: {
              appointmentId: {
                type: 'string',
                description: 'The appointment ID to cancel',
              },
              patientPhone: {
                type: 'string',
                description: 'Patient phone number (to find appointment if ID not known)',
              },
            },
          },
        },
        {
          name: 'find_patient_appointments',
          description: 'Find appointments for a patient by phone number',
          inputSchema: {
            type: 'object',
            properties: {
              patientPhone: {
                type: 'string',
                description: 'Patient phone number',
              },
              includeCompleted: {
                type: 'boolean',
                description: 'Include completed/past appointments',
                default: false,
              },
            },
            required: ['patientPhone'],
          },
        },
      ],
    }));

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          // ========================================
          // AGENT MANAGEMENT HANDLERS
          // ========================================
          case 'create_agent': {
            const result = await Agents.upsert({
              agentId: args.agentId,
              agentName: args.agentName,
              phoneNumber: args.phoneNumber,
              agentPrompt: args.agentPrompt,
              active: args.active !== undefined ? args.active : true,
              metadata: args.metadata || {},
            });

            return {
              content: [{
                type: 'text',
                text: JSON.stringify({
                  success: true,
                  message: result.upsertedCount > 0 
                    ? `Agent ${args.agentId} created successfully` 
                    : `Agent ${args.agentId} updated successfully`,
                  agentId: args.agentId,
                  phoneNumber: args.phoneNumber,
                }, null, 2),
              }],
            };
          }

          case 'get_agent_by_phone': {
            const agent = await Agents.getByPhoneNumber(args.phoneNumber);
            
            if (!agent) {
              return {
                content: [{
                  type: 'text',
                  text: JSON.stringify({
                    success: false,
                    error: `No agent found for phone number ${args.phoneNumber}`,
                  }, null, 2),
                }],
              };
            }

            return {
              content: [{
                type: 'text',
                text: JSON.stringify({
                  success: true,
                  agent,
                  prompt: agent.agentPrompt,
                }, null, 2),
              }],
            };
          }

          case 'list_agents': {
            const result = args.activeOnly 
              ? { agents: await Agents.getAllActive(), total: null }
              : await Agents.getAll(args.skip || 0, args.limit || 50);

            return {
              content: [{
                type: 'text',
                text: JSON.stringify({ success: true, ...result }, null, 2),
              }],
            };
          }

          case 'delete_agent': {
            const result = await Agents.delete(args.agentId);

            return {
              content: [{
                type: 'text',
                text: JSON.stringify({
                  success: result.deletedCount > 0,
                  message: result.deletedCount > 0 
                    ? `Agent ${args.agentId} deleted` 
                    : `Agent ${args.agentId} not found`,
                }, null, 2),
              }],
            };
          }

          case 'toggle_agent_status': {
            const result = await Agents.toggleStatus(args.agentId, args.active);

            return {
              content: [{
                type: 'text',
                text: JSON.stringify({
                  success: result.matchedCount > 0,
                  message: `Agent ${args.agentId} ${args.active ? 'activated' : 'deactivated'}`,
                }, null, 2),
              }],
            };
          }

          // ========================================
          // APPOINTMENT SYSTEM HANDLERS
          // ========================================
          case 'get_prompt_by_phone': {
            try {
              const response = await fetch(
                `${API_BASE_URL}/api/prompts/by-phone/${encodeURIComponent(args.assignedPhoneNumber)}`
              );
              const data = await response.json();

              return {
                content: [{
                  type: 'text',
                  text: JSON.stringify(data, null, 2),
                }],
              };
            } catch (error) {
              return {
                content: [{
                  type: 'text',
                  text: JSON.stringify({
                    success: false,
                    error: `Failed to fetch prompt: ${error.message}`,
                  }, null, 2),
                }],
              };
            }
          }

          case 'check_doctor_availability': {
            try {
              const params = new URLSearchParams({
                assignedPhoneNumber: args.assignedPhoneNumber,
              });
              if (args.date) params.append('date', args.date);
              if (args.specialization) params.append('specialization', args.specialization);
              if (args.doctorId) params.append('doctorId', args.doctorId);
              if (args.doctorName) params.append('doctorName', args.doctorName);

              const response = await fetch(`${API_BASE_URL}/api/availability?${params}`);
              const data = await response.json();

              return {
                content: [{
                  type: 'text',
                  text: JSON.stringify(data, null, 2),
                }],
              };
            } catch (error) {
              return {
                content: [{
                  type: 'text',
                  text: JSON.stringify({
                    success: false,
                    error: `Failed to check availability: ${error.message}`,
                  }, null, 2),
                }],
              };
            }
          }

          case 'get_doctors': {
            try {
              const params = new URLSearchParams();
              if (args.specialization) params.append('specialization', args.specialization);

              const response = await fetch(
                `${API_BASE_URL}/api/doctors/by-phone/${encodeURIComponent(args.assignedPhoneNumber)}?${params}`
              );
              const data = await response.json();

              return {
                content: [{
                  type: 'text',
                  text: JSON.stringify(data, null, 2),
                }],
              };
            } catch (error) {
              return {
                content: [{
                  type: 'text',
                  text: JSON.stringify({
                    success: false,
                    error: `Failed to fetch doctors: ${error.message}`,
                  }, null, 2),
                }],
              };
            }
          }

          case 'book_appointment': {
            try {
              const bookingData = {
                assignedPhoneNumber: args.assignedPhoneNumber,
                patientName: args.patientName,
                patientPhone: args.patientPhone,
                date: args.date,
                time: args.time,
                purpose: args.purpose || 'General appointment',
              };
              
              // Support both doctorId and doctorName
              if (args.doctorId) bookingData.doctorId = args.doctorId;
              if (args.doctorName) bookingData.doctorName = args.doctorName;
              
              const response = await fetch(`${API_BASE_URL}/api/availability/book`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(bookingData),
              });
              const data = await response.json();

              return {
                content: [{
                  type: 'text',
                  text: JSON.stringify(data, null, 2),
                }],
              };
            } catch (error) {
              return {
                content: [{
                  type: 'text',
                  text: JSON.stringify({
                    success: false,
                    error: `Failed to book appointment: ${error.message}`,
                  }, null, 2),
                }],
              };
            }
          }

          case 'cancel_appointment': {
            try {
              const response = await fetch(`${API_BASE_URL}/api/availability/cancel`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  appointmentId: args.appointmentId,
                  patientPhone: args.patientPhone,
                }),
              });
              const data = await response.json();

              return {
                content: [{
                  type: 'text',
                  text: JSON.stringify(data, null, 2),
                }],
              };
            } catch (error) {
              return {
                content: [{
                  type: 'text',
                  text: JSON.stringify({
                    success: false,
                    error: `Failed to cancel appointment: ${error.message}`,
                  }, null, 2),
                }],
              };
            }
          }

          case 'find_patient_appointments': {
            try {
              const cleanPhone = args.patientPhone.replace(/\D/g, '');
              const response = await fetch(
                `${API_BASE_URL}/api/appointments?phone=${cleanPhone}`
              );
              const data = await response.json();

              // Filter based on includeCompleted
              let appointments = data.appointments || [];
              if (!args.includeCompleted) {
                appointments = appointments.filter(
                  apt => ['scheduled', 'confirmed'].includes(apt.status)
                );
              }

              return {
                content: [{
                  type: 'text',
                  text: JSON.stringify({
                    success: true,
                    patientPhone: args.patientPhone,
                    count: appointments.length,
                    appointments: appointments.map(apt => ({
                      id: apt._id,
                      date: apt.date,
                      time: apt.time,
                      doctorName: apt.metadata?.doctor_name,
                      status: apt.status,
                      purpose: apt.purpose,
                    })),
                  }, null, 2),
                }],
              };
            } catch (error) {
              return {
                content: [{
                  type: 'text',
                  text: JSON.stringify({
                    success: false,
                    error: `Failed to find appointments: ${error.message}`,
                  }, null, 2),
                }],
              };
            }
          }

          default:
            return {
              content: [{
                type: 'text',
                text: JSON.stringify({
                  success: false,
                  error: `Unknown tool: ${name}`,
                }, null, 2),
              }],
            };
        }
      } catch (error) {
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: error.message,
              stack: error.stack,
            }, null, 2),
          }],
        };
      }
    });
  }

  async start() {
    // Connect to database
    await connectDB();

    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Millis AI Agent MCP Server v2.0 running on stdio');
    console.error('Available tools: Agent management + Appointment system');
  }
}

// Start the server
const server = new MillisAgentServer();
server.start().catch(console.error);
