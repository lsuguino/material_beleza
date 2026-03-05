/**
 * Parse WebVTT content into plain text (and optional cue list).
 * Handles WEBVTT header, timestamps, and cue text.
 */
export interface VttCue {
  start: number;
  end: number;
  text: string;
}

export function parseVtt(vttContent: string): { text: string; cues: VttCue[] } {
  const lines = vttContent.trim().split(/\r?\n/);
  const cues: VttCue[] = [];
  let i = 0;

  // Skip WEBVTT header and optional metadata
  while (i < lines.length) {
    const line = lines[i];
    if (line.startsWith('WEBVTT') || line.startsWith('NOTE') || line === '') {
      i++;
      continue;
    }
    break;
  }

  while (i < lines.length) {
    const line = lines[i];
    if (!line) {
      i++;
      continue;
    }
    // Timestamp line: 00:00:00.000 --> 00:00:05.000
    const timeMatch = line.match(
      /^(\d{2}):(\d{2}):(\d{2})\.(\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2})\.(\d{3})/
    );
    if (timeMatch) {
      const start =
        parseInt(timeMatch[1], 10) * 3600 +
        parseInt(timeMatch[2], 10) * 60 +
        parseInt(timeMatch[3], 10) +
        parseInt(timeMatch[4], 10) / 1000;
      const end =
        parseInt(timeMatch[5], 10) * 3600 +
        parseInt(timeMatch[6], 10) * 60 +
        parseInt(timeMatch[7], 10) +
        parseInt(timeMatch[8], 10) / 1000;
      const textLines: string[] = [];
      i++;
      while (i < lines.length && lines[i] && !lines[i].match(/^\d{2}:\d{2}:\d{2}/)) {
        textLines.push(lines[i]);
        i++;
      }
      const text = textLines.join(' ').replace(/\s+/g, ' ').trim();
      if (text) {
        cues.push({ start, end, text });
      }
      continue;
    }
    i++;
  }

  const text = cues.map((c) => c.text).join('\n');
  return { text, cues };
}
