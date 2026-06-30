const bcrypt = require('bcryptjs');

async function main() {
    const hash = "$2a$10$59sxsvb9RKVAjYrCp/cn9O82fCrpy7rG0spirhj/OVbqD92UnJfbq";
    const passwordsToTest = ['admin123', 'admin', '123456'];
    for (const pwd of passwordsToTest) {
        const isValid = await bcrypt.compare(pwd, hash);
        console.log(`Password '${pwd}' is valid: ${isValid}`);
    }
}

main().catch(console.error);
