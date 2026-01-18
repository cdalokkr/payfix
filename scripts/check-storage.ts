// Script to check Supabase storage bucket configuration
import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabaseServiceRole = process.env.SUPABASE_SERVICE_ROLE_KEY!

async function checkStorage() {
    console.log('\n🔍 SUPABASE STORAGE DIAGNOSTICS\n')
    console.log('=' .repeat(50))

    // 1. Check env vars
    console.log('\n📌 Environment Variables:')
    console.log('  SUPABASE_URL:', supabaseUrl ? '✅ Set' : '❌ Missing')
    console.log('  ANON_KEY:', supabaseAnonKey ? '✅ Set' : '❌ Missing')
    console.log('  SERVICE_ROLE:', supabaseServiceRole ? '✅ Set' : '❌ Missing')

    if (!supabaseUrl || !supabaseServiceRole) {
        console.log('\n❌ Missing required env vars. Cannot continue.')
        return
    }

    // Use service role to bypass RLS and check bucket config
    const adminClient = createClient(supabaseUrl, supabaseServiceRole, {
        auth: { persistSession: false }
    })

    // 2. List all buckets
    console.log('\n📦 Storage Buckets:')
    const { data: buckets, error: bucketsError } = await adminClient.storage.listBuckets()
    
    if (bucketsError) {
        console.log('  ❌ Error listing buckets:', bucketsError.message)
        return
    }

    if (!buckets || buckets.length === 0) {
        console.log('  ⚠️ No buckets found!')
        console.log('  → Create "avatars" bucket in Supabase Dashboard → Storage')
        return
    }

    buckets.forEach(bucket => {
        const isAvatars = bucket.name === 'avatars'
        console.log(`  ${isAvatars ? '→' : ' '} ${bucket.name}: ${bucket.public ? '🌐 PUBLIC' : '🔒 PRIVATE'}${isAvatars ? ' ← TARGET BUCKET' : ''}`)
    })

    // 3. Check avatars bucket specifically
    const avatarsBucket = buckets.find(b => b.name === 'avatars')
    if (!avatarsBucket) {
        console.log('\n❌ "avatars" bucket NOT FOUND!')
        console.log('  → Create it in Supabase Dashboard → Storage → New Bucket')
        return
    }

    console.log('\n📋 Avatars Bucket Details:')
    console.log('  Name:', avatarsBucket.name)
    console.log('  Public:', avatarsBucket.public ? '✅ YES (Good for avatars)' : '❌ NO (Should be public)')
    console.log('  Created:', avatarsBucket.created_at)

    // 4. Try a test upload with service role (bypasses RLS)
    console.log('\n🧪 Test Upload (Service Role):')
    const testBlob = new Blob(['test'], { type: 'text/plain' })
    const testFileName = `_test_${Date.now()}.txt`
    
    const { error: uploadError } = await adminClient.storage
        .from('avatars')
        .upload(testFileName, testBlob, { upsert: true })

    if (uploadError) {
        console.log('  ❌ Upload failed:', uploadError.message)
    } else {
        console.log('  ✅ Upload succeeded with service role')
        
        // Clean up test file
        await adminClient.storage.from('avatars').remove([testFileName])
        console.log('  🧹 Test file removed')
    }

    // 5. Test with ANON key (subject to RLS)
    console.log('\n🧪 Test Upload (Anon Key - Subject to RLS):')
    const anonClient = createClient(supabaseUrl, supabaseAnonKey, {
        auth: { persistSession: false }
    })
    
    const { error: anonError } = await anonClient.storage
        .from('avatars')
        .upload(`_anon_test_${Date.now()}.txt`, testBlob, { upsert: true })

    if (anonError) {
        console.log('  ❌ Anon upload failed:', anonError.message)
        console.log('\n⚠️ ISSUE: RLS is blocking anonymous/unauthenticated uploads.')
        console.log('   This is expected for PUBLIC buckets - they only allow public READ, not WRITE.')
        console.log('\n🔧 SOLUTION: Use a server-side API route for uploads.')
    } else {
        console.log('  ✅ Anon upload succeeded')
        await anonClient.storage.from('avatars').remove([`_anon_test_${Date.now()}.txt`])
    }

    // 6. Summary
    console.log('\n' + '='.repeat(50))
    console.log('📊 SUMMARY:')
    console.log('='.repeat(50))
    
    if (avatarsBucket.public) {
        console.log('  ✅ Bucket is PUBLIC (good for reading)')
        console.log('  ⚠️ PUBLIC bucket still requires RLS for WRITES')
        console.log('\n💡 RECOMMENDATION:')
        console.log('   Create a server-side API route for uploads that uses')
        console.log('   the SERVICE_ROLE_KEY to bypass RLS.')
    } else {
        console.log('  ❌ Bucket is PRIVATE')
        console.log('  → Make it public in Supabase Dashboard')
    }
    console.log()
}

checkStorage().catch(console.error)
