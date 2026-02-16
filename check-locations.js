
const { db } = require('./lib/db');
const { officeLocations } = require('./lib/db/schema');

async function check() {
    try {
        const locs = await db.select().from(officeLocations);
        console.log(`Found ${locs.length} office locations.`);
        locs.forEach(l => console.log(`- ${l.name} (${l.latitude}, ${l.longitude}, r=${l.radius_meters})`));
    } catch (e) {
        console.error(e);
    }
}
check();
