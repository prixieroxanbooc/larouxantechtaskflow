#!/usr/bin/env node
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createMcpServer } from './factory.js';

const API_URL = process.env.API_URL || 'http://localhost:3001';
const API_TOKEN = process.env.API_TOKEN || '';

async function main() {
  const server = createMcpServer(API_URL, API_TOKEN);
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`TaskFlow MCP stdio server running (API: ${API_URL})`);
}

main().catch(console.error);
