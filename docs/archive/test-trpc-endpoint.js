/**
 * tRPC Endpoint Test Script
 * Tests the tRPC API endpoint to verify it's working correctly
 */

const testTRPCEndpoint = async () => {
    console.log('=== tRPC ENDPOINT TEST ===\n');

    try {
        // Test the tRPC auth.login endpoint
        console.log('Testing tRPC endpoint: POST /api/trpc/auth.login');

        const response = await fetch('http://localhost:3001/api/trpc/auth.login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                id: 1,
                json: {
                    email: 'test@example.com',
                    password: 'testpassword'
                }
            })
        });

        console.log('Response status:', response.status);
        console.log('Response headers:', Object.fromEntries(response.headers.entries()));

        const text = await response.text();
        console.log('Response body (first 200 chars):', text.substring(0, 200));

        if (response.status === 404) {
            console.log('\n❌ ISSUE DETECTED: 404 Not Found');
            console.log('This suggests the tRPC endpoint is not properly configured or the server is not running');
        } else if (text.startsWith('<!DOCTYPE')) {
            console.log('\n❌ ISSUE DETECTED: HTML Response instead of JSON');
            console.log('This suggests the endpoint is returning an HTML error page instead of JSON');
        } else {
            console.log('\n✅ SUCCESS: tRPC endpoint is responding with JSON');
        }

    } catch (error) {
        console.log('\n❌ CONNECTION ERROR:', error.message);
        console.log('This suggests the development server is not running on port 3001');
    }
};

// Run the test
testTRPCEndpoint();