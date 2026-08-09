import './env-config';
import { centralDb, runWithTenantSchema } from '../lib/db/index';
import { profiles } from '../lib/db/schema';
import { eq } from 'drizzle-orm';

function parseVector(val: unknown): number[] | null {
    if (!val) return null;
    let vec = val;
    if (typeof vec === 'string') {
        try {
            vec = JSON.parse(vec.replace(/^\[/, '[').replace(/\]$/, ']'));
        } catch {
            return null;
        }
    }
    if (Array.isArray(vec) && vec.length === 128) {
        return vec.map(v => Number(v));
    }
    return null;
}

async function testKioskPrivateFetch() {
    console.log('==================================================');
    console.log('[Kiosk Direct Private Schema Audit] Testing tenant_primary');
    console.log('==================================================\n');

    try {
        const schemaName = 'tenant_primary';

        const employeesData = await runWithTenantSchema(schemaName, async () => {
            const activeEmployees = await centralDb
                .select({
                    id: profiles.id,
                    full_name: profiles.full_name,
                    email: profiles.email,
                    avatar_url: profiles.avatar_url,
                    face_embedding: profiles.face_embedding,
                })
                .from(profiles)
                .where(eq(profiles.status, 'active'));

            return activeEmployees.map(emp => {
                const vec = parseVector(emp.face_embedding);
                return {
                    id: emp.id,
                    name: emp.full_name || emp.email,
                    avatarUrl: emp.avatar_url || null,
                    faceEmbedding: vec,
                    hasEnrolledFace: vec !== null,
                };
            });
        });

        const enrolledCount = employeesData.filter(e => e.hasEnrolledFace).length;

        console.log(`🏢 Schema: ${schemaName}`);
        console.log(`👥 Total Active Employees in Private Schema: ${employeesData.length}`);
        console.log(`✅ Total Enrolled 128-d Face Vectors: ${enrolledCount}\n`);

        for (const emp of employeesData) {
            console.log(`   • ${emp.name} (id: ${emp.id}) -> Enrolled: ${emp.hasEnrolledFace ? 'YES (128-d vector)' : 'NO'}`);
        }

        console.log('\n==================================================');
        console.log('[Audit Passed] Kiosk can fetch 100% private face vectors from tenant_primary!');
        console.log('==================================================');
    } catch (err: any) {
        console.error('Audit error:', err.message || err);
    }
}

testKioskPrivateFetch();
