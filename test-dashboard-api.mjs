#!/usr/bin/env node
/**
 * Dashboard API Test Script
 * Tests the Dashboard API endpoint to verify field names match correctly
 */

import axios from 'axios';

const API_URL = 'http://localhost:5000/api/dashboard';
const TEST_TOKEN = process.env.TEST_TOKEN || null;

const axiosInstance = axios.create({
  baseURL: 'http://localhost:5000',
  validateStatus: () => true, // Don't throw on any status code
});

if (TEST_TOKEN) {
  axiosInstance.defaults.headers.common['Authorization'] = `Bearer ${TEST_TOKEN}`;
}

async function testDashboardAPI() {
  console.log('🧪 Testing Dashboard API...\n');

  try {
    // Test 1: Check API connectivity
    console.log('Test 1: API Connectivity');
    console.log('------------------------');
    const response = await axiosInstance.get('/api/dashboard');
    
    if (response.status === 401 || response.status === 403) {
      console.log('⚠️  Authentication required (Status: ' + response.status + ')');
      console.log('   This is expected if no valid token is provided.\n');
      return;
    }

    if (response.status !== 200) {
      console.log(`❌ Failed with status ${response.status}`);
      console.log(`   Response:`, response.data);
      return;
    }

    console.log('✅ API is reachable\n');

    // Test 2: Verify response structure
    console.log('Test 2: Response Structure');
    console.log('------------------------');
    const data = response.data?.data || response.data;

    const requiredFields = [
      'totalInventory',
      'in_stockItems',
      'soldItems',
      'pendingApproval',
      'partiallySoldItems',
      'totalWeight',
      'totalPieces',
      'totalSalesAmount',
      'inStockValue',
      'recentSales'
    ];

    let allFieldsPresent = true;
    requiredFields.forEach(field => {
      if (field in data) {
        console.log(`✅ "${field}": ${typeof data[field]} = ${JSON.stringify(data[field]).substring(0, 50)}`);
      } else {
        console.log(`❌ Missing field: "${field}"`);
        allFieldsPresent = false;
      }
    });

    if (!allFieldsPresent) {
      console.log('\n❌ Some required fields are missing!');
      return;
    }

    // Test 3: Verify field types
    console.log('\nTest 3: Field Types');
    console.log('-------------------');
    const expectedTypes = {
      totalInventory: 'number',
      in_stockItems: 'number',
      soldItems: 'number',
      pendingApproval: 'number',
      partiallySoldItems: 'number',
      totalWeight: 'number',
      totalPieces: 'number',
      totalSalesAmount: 'number',
      inStockValue: ['number', 'string'], // Can be number or string (-)
      recentSales: 'object' // Should be array
    };

    let allTypesCorrect = true;
    Object.entries(expectedTypes).forEach(([field, expectedType]) => {
      const actualType = Array.isArray(expectedType) 
        ? expectedType.includes(typeof data[field]) 
        : typeof data[field] === expectedType;
      
      if (actualType) {
        console.log(`✅ "${field}": ${typeof data[field]}`);
      } else {
        console.log(`❌ "${field}": Expected ${expectedType}, got ${typeof data[field]}`);
        allTypesCorrect = false;
      }
    });

    if (allTypesCorrect) {
      console.log('\n✅ All tests passed!');
    } else {
      console.log('\n❌ Some type mismatches found.');
    }

    // Test 4: Verify recentSales structure
    console.log('\nTest 4: Recent Sales Structure');
    console.log('-----------------------------');
    if (Array.isArray(data.recentSales)) {
      console.log(`✅ recentSales is an array with ${data.recentSales.length} items`);
      if (data.recentSales.length > 0) {
        const firstSale = data.recentSales[0];
        console.log(`   First sale keys: ${Object.keys(firstSale).join(', ')}`);
      }
    } else {
      console.log(`❌ recentSales is not an array`);
    }

    console.log('\n📊 Dashboard Stats Summary:');
    console.log(`   Total Inventory: ${data.totalInventory}`);
    console.log(`   In Stock: ${data.in_stockItems}`);
    console.log(`   Partially Sold: ${data.partiallySoldItems}`);
    console.log(`   Fully Sold: ${data.soldItems}`);
    console.log(`   Pending Approval: ${data.pendingApproval}`);
    console.log(`   Total Weight: ${data.totalWeight} ct`);
    console.log(`   Total Pieces: ${data.totalPieces}`);
    console.log(`   In-Stock Value: ${typeof data.inStockValue === 'number' ? '$' + data.inStockValue : data.inStockValue}`);
    console.log(`   Total Sales: $${data.totalSalesAmount}`);

  } catch (error) {
    console.error('❌ Test failed with error:');
    console.error(`   ${error.message}`);
    if (error.code === 'ECONNREFUSED') {
      console.error('   Backend server is not running at localhost:5000');
      console.error('   Please start the backend with: npm start (in bc directory)');
    }
  }
}

testDashboardAPI();
