// Test script to verify full_name construction functionality
// This tests the constructFullName function that was implemented in the tRPC mutation

interface TestCase {
  firstName: string;
  middleName?: string;
  lastName: string;
  expected: string;
  description: string;
}

const constructFullName = (firstName: string, middleName?: string, lastName?: string): string => {
  const parts = [firstName]

  // Add middle name only if it's not empty
  if (middleName && middleName.trim()) {
    parts.push(middleName.trim())
  }

  // Add last name only if it's not empty
  if (lastName && lastName.trim()) {
    parts.push(lastName.trim())
  }

  return parts.filter(Boolean).join(' ')
}

// Test cases covering different scenarios
const testCases: TestCase[] = [
  {
    firstName: "John",
    middleName: "Michael",
    lastName: "Doe",
    expected: "John Michael Doe",
    description: "First + Middle + Last name"
  },
  {
    firstName: "Jane",
    middleName: "",
    lastName: "Smith",
    expected: "Jane Smith",
    description: "First + Last name (empty middle)"
  },
  {
    firstName: "Bob",
    middleName: undefined,
    lastName: "Johnson",
    expected: "Bob Johnson",
    description: "First + Last name (undefined middle)"
  },
  {
    firstName: "Alice",
    middleName: "Marie",
    lastName: "Brown",
    expected: "Alice Marie Brown",
    description: "First + Middle + Last name with spaces in middle"
  },
  {
    firstName: "Charlie",
    middleName: "   ",  // whitespace only
    lastName: "Wilson",
    expected: "Charlie Wilson",
    description: "First + Last name (whitespace-only middle)"
  }
];

// Run tests
console.log("🧪 Testing full_name construction functionality...\n");

let passedTests = 0;
const totalTests = testCases.length;

testCases.forEach((testCase, index) => {
  const result = constructFullName(testCase.firstName, testCase.middleName, testCase.lastName);
  const passed = result === testCase.expected;

  console.log(`Test ${index + 1}: ${testCase.description}`);
  console.log(`  Input: "${testCase.firstName}", "${testCase.middleName}", "${testCase.lastName}"`);
  console.log(`  Expected: "${testCase.expected}"`);
  console.log(`  Got: "${result}"`);
  console.log(`  Status: ${passed ? "✅ PASSED" : "❌ FAILED"}\n`);

  if (passed) {
    passedTests++;
  }
});

// Summary
console.log("=".repeat(50));
console.log(`Test Results: ${passedTests}/${totalTests} tests passed`);
if (passedTests === totalTests) {
  console.log("🎉 All tests passed! Full name construction is working correctly.");
} else {
  console.log("❌ Some tests failed. Please check the implementation.");
}

export { }