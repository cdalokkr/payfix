async function test() {
    const url = 'https://payfix-git-develop-corebitdigital.vercel.app/avatars/default-male.png';
    console.log(`Fetching ${url}...`);
    try {
        const res = await fetch(url);
        console.log(`Status: ${res.status} ${res.statusText}`);
        const text = await res.text();
        console.log("First 200 characters of response:");
        console.log(text.substring(0, 200));
        console.log("Is HTML:", text.includes('<!DOCTYPE html>') || text.includes('<html'));
    } catch (err: any) {
        console.error('Error fetching:', err);
    }
}
test();
