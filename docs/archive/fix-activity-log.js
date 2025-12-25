const fs = require('fs');

const filePath = 'components/dashboard/admin-overview.tsx';
let content = fs.readFileSync(filePath, 'utf8');

// Find and replace the log message construction logic
const oldPattern = /const role = activity\.profiles\?\.role \|\| 'user'\r?\n\s+const email = activity\.profiles\?\.email \|\| activity\.profiles\?\.full_name \|\| 'Unknown User'\r?\n\s+const isAdmin = role === 'admin'\r?\n\s+const timestamp = activity\.created_at \? new Date\(activity\.created_at\)\.toLocaleString\(\) : 'Unknown time'\r?\n\s+const type = \(activity\.activity_type \|\| ''\)\.toLowerCase\(\)\r?\n\s+let logMessage = ''\r?\n\s+\/\/ Format:[\s\S]*?logMessage = `\$\{role\} - \$\{action\} for user \[ \$\{email\} \] at \$\{timestamp\}\.`\r?\n\s+\}/;

const newCode = `const role = activity.profiles?.role || 'user'\r\n                      const isAdmin = role === 'admin'\r\n                      \r\n                      // Use the description from the database which now contains the formatted message\r\n                      const logMessage = activity.description || 'Activity logged'`;

content = content.replace(oldPattern, newCode);

fs.writeFileSync(filePath, content, 'utf8');
console.log('File updated successfully');
