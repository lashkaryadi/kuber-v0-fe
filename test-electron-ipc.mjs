#!/usr/bin/env node
/**
 * Electron IPC Dashboard Handler Test
 * Tests the Electron IPC handlers to verify field name mappings
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

console.log('🧪 Testing Electron IPC Handlers...\n');

// Test 1: Check IPC handler file exists
console.log('Test 1: IPC Handler File');
console.log('------------------------');
const ipcHandlersPath = path.join(__dirname, 'electron/ipcHandlers.js');

if (fs.existsSync(ipcHandlersPath)) {
  console.log('✅ IPC handlers file exists');
  const content = fs.readFileSync(ipcHandlersPath, 'utf-8');
  
  // Check for dashboard handler
  if (content.includes('dashboard:getStats')) {
    console.log('✅ Dashboard IPC handler is defined');
    
    // Check for correct field names
    const requiredFields = [
      'in_stockItems',
      'pendingApproval',
      'totalWeight',
      'totalPieces',
      'totalSalesAmount'
    ];
    
    let fieldCount = 0;
    requiredFields.forEach(field => {
      if (content.includes(field)) {
        console.log(`✅ Field "${field}" is used`);
        fieldCount++;
      }
    });
    
    if (fieldCount === requiredFields.length) {
      console.log(`\n✅ All required fields are present in IPC handler`);
    } else {
      console.log(`\n⚠️  Only ${fieldCount}/${requiredFields.length} fields found`);
    }
  } else {
    console.log('⚠️  Dashboard IPC handler not found');
  }
} else {
  console.log('❌ IPC handlers file not found at:', ipcHandlersPath);
}

// Test 2: Check electron/db.js
console.log('\n\nTest 2: Electron DB File');
console.log('------------------------');
const dbPath = path.join(__dirname, 'electron/db.js');

if (fs.existsSync(dbPath)) {
  console.log('✅ Electron DB file exists');
  const dbContent = fs.readFileSync(dbPath, 'utf-8');
  
  // Check for dashboard query
  if (dbContent.includes('dashboard') || dbContent.includes('stats')) {
    console.log('✅ Dashboard-related code found');
  } else {
    console.log('⚠️  No dashboard-specific code found');
  }
} else {
  console.log('⚠️  Electron DB file not found at:', dbPath);
}

// Test 3: Verify API service types
console.log('\n\nTest 3: API Service Types');
console.log('------------------------');
const apiPath = path.join(__dirname, 'src/services/api.ts');

if (fs.existsSync(apiPath)) {
  console.log('✅ API service file exists');
  const apiContent = fs.readFileSync(apiPath, 'utf-8');
  
  // Check for DashboardStats interface
  if (apiContent.includes('interface DashboardStats')) {
    console.log('✅ DashboardStats interface is defined');
    
    const requiredFields = [
      'in_stockItems',
      'pendingApproval',
      'partiallySoldItems',
      'totalWeight',
      'totalPieces',
      'totalSalesAmount'
    ];
    
    const interfaceMatch = apiContent.match(/interface DashboardStats\s*{([^}]+)}/s);
    if (interfaceMatch) {
      const interfaceBody = interfaceMatch[1];
      let fieldCount = 0;
      
      requiredFields.forEach(field => {
        if (interfaceBody.includes(field)) {
          console.log(`✅ "${field}" is in interface`);
          fieldCount++;
        }
      });
      
      if (fieldCount === requiredFields.length) {
        console.log(`\n✅ All required fields are in DashboardStats interface`);
      }
    }
  } else {
    console.log('⚠️  DashboardStats interface not found');
  }
} else {
  console.log('❌ API service file not found');
}

console.log('\n\n📋 Test Summary');
console.log('===============');
console.log('To test the running Electron app:');
console.log('1. Make sure the backend is running: cd bc && npm start');
console.log('2. Run the Dashboard API test: node test-dashboard-api.mjs');
console.log('3. Check the Electron app console for any errors (Dev Tools)');
console.log('4. Navigate to Dashboard to see if it loads correctly');
console.log('\nIf authenticated, you should see:');
console.log('- Dashboard stats with correct field names');
console.log('- Recent sales list populated');
console.log('- No console errors related to undefined fields');
