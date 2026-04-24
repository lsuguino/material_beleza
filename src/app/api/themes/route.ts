import { NextResponse } from 'next/server';
import { readdir, readFile } from 'fs/promises';
import path from 'path';
import { COURSE_THEMES } from '@/lib/courseThemes';

export async function GET() {
  try {
    const themesDir = path.join(process.cwd(), 'themes');
    const themes: Array<{ id: string; name: string }> = [];
    try {
      const files = await readdir(themesDir);
      const jsonFiles = files.filter((f) => f.endsWith('.json'));
      for (const file of jsonFiles) {
        const id = file.replace(/\.json$/, '');
        const raw = await readFile(path.join(themesDir, file), 'utf-8');
        const data = JSON.parse(raw) as Record<string, unknown>;
        themes.push({
          id,
          name: (data.name as string) || id,
        });
      }
    } catch {
      // themes folder missing or empty
    }
    if (themes.length === 0) {
      return NextResponse.json(
        Object.entries(COURSE_THEMES).map(([id, t]) => ({ id, name: t.name }))
      );
    }
    return NextResponse.json(themes);
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      Object.entries(COURSE_THEMES).map(([id, t]) => ({ id, name: t.name })),
      { status: 200 }
    );
  }
}
