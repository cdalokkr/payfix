import { NextRequest, NextResponse } from 'next/server'
import { writeFile, mkdir, readdir, unlink } from 'fs/promises'
import path from 'path'

export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData()
        const file = formData.get('file') as File
        const userId = formData.get('userId') as string

        if (!file) {
            return NextResponse.json(
                { error: 'No file provided' },
                { status: 400 }
            )
        }

        if (!userId) {
            return NextResponse.json(
                { error: 'No userId provided' },
                { status: 400 }
            )
        }

        // Validate file type
        if (!file.type.startsWith('image/')) {
            return NextResponse.json(
                { error: 'File must be an image' },
                { status: 400 }
            )
        }

        // Validate file size (max 5MB)
        const maxSize = 5 * 1024 * 1024
        if (file.size > maxSize) {
            return NextResponse.json(
                { error: 'File size must be less than 5MB' },
                { status: 400 }
            )
        }

        // Get file extension
        const fileExt = file.name.split('.').pop()
        const fileName = `user-${userId}-${Date.now()}.${fileExt}`

        // Convert file to buffer
        const bytes = await file.arrayBuffer()
        const buffer = Buffer.from(bytes)

        // Ensure avatars directory exists
        const avatarsDir = path.join(process.cwd(), 'public', 'avatars')
        try {
            await mkdir(avatarsDir, { recursive: true })
        } catch (error) {
            // Directory might already exist, ignore error
        }

        // Delete existing avatars for this user
        try {
            const files = await readdir(avatarsDir)
            const userFiles = files.filter(f => f.startsWith(`user-${userId}-`))

            for (const file of userFiles) {
                const filePathToDelete = path.join(avatarsDir, file)
                await unlink(filePathToDelete)
                console.log('[UploadAvatar] Deleted old avatar:', file)
            }
        } catch (error) {
            console.warn('[UploadAvatar] Error cleaning up old avatars:', error)
            // Continue with upload even if cleanup fails
        }

        // Write file to public/avatars
        const filePath = path.join(avatarsDir, fileName)
        await writeFile(filePath, buffer)

        // Return the public URL path
        const publicPath = `/avatars/${fileName}`

        console.log('[UploadAvatar] File saved:', publicPath)

        return NextResponse.json({
            success: true,
            path: publicPath
        })
    } catch (error) {
        console.error('[UploadAvatar] Error:', error)
        return NextResponse.json(
            { error: 'Failed to upload file' },
            { status: 500 }
        )
    }
}
