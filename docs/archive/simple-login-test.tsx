"use client";

import React, { useState } from 'react';
import { PasswordInput } from "@/components/ui/password-input";

export default function SimpleLoginTest() {
  const [email, setEmail] = useState('admin@example.com');
  const [password, setPassword] = useState('password123');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const handleLogin = async () => {
    setLoading(true);
    setMessage('');

    try {
      // Simple fetch test to see if tRPC is working
      const response = await fetch('/api/trpc/auth.login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          batch: [{
            json: { email, password }
          }]
        })
      });

      if (response.ok) {
        const data = await response.json();
        setMessage('Login endpoint is working!');
      } else {
        setMessage(`Login failed: ${response.status}`);
      }
    } catch (error) {
      setMessage(`Error: ${error instanceof Error ? error.message : 'An unknown error occurred'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Simple Login Test</h1>
      
      <div className="space-y-4">
        <div>
          <label>Email:</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="border p-2 ml-2"
          />
        </div>
        
        <div>
          <label>Password:</label>
          <PasswordInput
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="border p-2 ml-2 inline-block w-auto"
          />
        </div>
        
        <button
          onClick={handleLogin}
          disabled={loading}
          className="bg-blue-500 text-white px-4 py-2 rounded"
        >
          {loading ? 'Testing...' : 'Test Login Endpoint'}
        </button>
        
        {message && (
          <div className={`p-2 rounded ${message.includes('working') ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
            {message}
          </div>
        )}
      </div>
    </div>
  );
}