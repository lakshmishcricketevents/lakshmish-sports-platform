import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;
    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Build upload path
    const uploadDir = path.join(process.cwd(), 'public', 'uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    // Clean original name and generate unique name
    const ext = path.extname(file.name) || '.png';
    const cleanName = file.name.replace(/[^a-zA-Z0-9]/g, '_');
    const name = `upload_${Date.now()}_${cleanName.substring(0, 10)}${ext}`;
    const filePath = path.join(uploadDir, name);

    // Save to filesystem
    await fs.promises.writeFile(filePath, buffer);

    // Return relative URL path
    return NextResponse.json({ url: `/uploads/${name}` });
  } catch (error: any) {
    console.error('Local upload endpoint error:', error);
    return NextResponse.json({ error: error.message || 'File upload failed' }, { status: 500 });
  }
}
