async function main() {
    console.log("Starting login test...");

    // 1. Get CSRF token
    const csrfRes = await fetch('http://localhost:3000/api/auth/csrf');
    const csrfData = await csrfRes.json();
    const csrfToken = csrfData.csrfToken;
    console.log("CSRF Token:", csrfToken);

    // 2. Attempt login
    const params = new URLSearchParams();
    params.append('email', 'thiagow.net@gmail.com');
    params.append('password', 'admin123');
    params.append('csrfToken', csrfToken);
    params.append('json', 'true');

    // extract cookies from csrfRes
    const cookieHeader = csrfRes.headers.get('set-cookie');
    let cookies = '';
    if (cookieHeader) {
        // Simple extraction for multiple set-cookie
        cookies = cookieHeader.split(',').map(c => c.split(';')[0].trim()).join('; ');
    }

    const res = await fetch('http://localhost:3000/api/auth/callback/credentials', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Cookie': cookies
        },
        body: params.toString()
    });

    try {
        const data = await res.json();
        console.log("Login Response HTTP Status:", res.status);
        console.log("Login Response Body:", data);
    } catch (e) {
        console.log("Login Response HTTP Status:", res.status);
        const text = await res.text();
        console.log("Login Response Text:", text.substring(0, 500));
    }
}

main().catch(console.error);
